import { NextRequest, NextResponse } from "next/server";
import { stripe, LIFETIME_PRICE_IDS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }
    }
  } catch (error) {
    console.error("[webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[webhook] checkout.session.completed", { mode: session.mode, metadata: session.metadata });

  // Lifetime is a one-time payment, so it arrives as mode "payment".
  if (session.mode === "payment") {
    await handleLifetimePurchase(session);
    return;
  }

  if (session.mode !== "subscription") return;

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[webhook] No userId in session metadata");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);

  console.log("[webhook] Updating user", { userId, priceId, tier });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tier, stripeSubId: subscription.id },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        status: "ACTIVE",
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        status: "ACTIVE",
      },
    }),
  ]);

  console.log("[webhook] User tier updated to", tier);
}

async function handleLifetimePurchase(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[webhook] No userId in lifetime session metadata");
    return;
  }

  if (session.payment_status !== "paid") {
    console.log("[webhook] Lifetime session not paid yet", { userId, status: session.payment_status });
    return;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id;

  if (!priceId || !LIFETIME_PRICE_IDS.includes(priceId)) {
    console.error("[webhook] Payment session is not a known lifetime price", { userId, priceId });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { tier: "LIFETIME" },
  });

  console.log("[webhook] User granted LIFETIME", { userId });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: "ACTIVE",
    },
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  /* Lifetime access is bought outright, so a subscription ending must never
   * pull it back down to FREE. */
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });

  if (existing?.tier === "LIFETIME") {
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: mapStripeStatus(subscription.status),
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
    return;
  }

  const isActive = subscription.status === "active";
  const tier = isActive
    ? getTierFromPriceId(subscription.items.data[0]?.price.id)
    : "FREE";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tier },
    }),
    prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status: mapStripeStatus(subscription.status),
        stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    }),
  ]);
}

function getTierFromPriceId(priceId?: string): "FREE" | "PREMIUM" | "PRO" | "LIFETIME" {
  if (!priceId) return "FREE";
  if (LIFETIME_PRICE_IDS.includes(priceId)) return "LIFETIME";
  if (priceId === process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID) return "PREMIUM";
  if (
    priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID
  )
    return "PRO";
  return "FREE";
}

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "CANCELED" | "PAST_DUE" | "INCOMPLETE" {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "canceled":
      return "CANCELED";
    case "past_due":
      return "PAST_DUE";
    default:
      return "INCOMPLETE";
  }
}
