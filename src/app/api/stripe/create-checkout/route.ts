import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const checkoutSchema = z.object({
  priceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = checkoutSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
  }

  const { priceId } = result.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    });

    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email ?? undefined,
        name: user?.name ?? undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
      metadata: { userId: session.user.id },
      subscription_data: {
        metadata: { userId: session.user.id },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[create-checkout]", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
