import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

/**
 * Plan definitions — the single source of truth for what each tier costs and
 * offers. Extraction quotas are enforced by TIER_LIMITS in lib/usage.ts; the
 * numbers quoted in `features` here must agree with it.
 */
export const PLANS = {
  FREE: {
    name: "Free",
    tagline: "For getting started",
    price: "$0",
    period: "forever",
    features: [
      "10 recipe extractions / month",
      "Save recipes to your account",
      "Full recipe history",
    ],
  },
  PREMIUM: {
    name: "Premium",
    tagline: "For regular cooks",
    price: "$2.99",
    period: "/month",
    priceMonthly: 299,
    mode: "subscription",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID ?? process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? "",
    features: [
      "20 recipe extractions / month",
      "Save unlimited recipes",
      "Full recipe history",
    ],
  },
  PRO: {
    name: "Pro",
    tagline: "For power users",
    price: "$9.99",
    period: "/month",
    priceMonthly: 999,
    mode: "subscription",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
    features: [
      "Unlimited extractions",
      "Unlimited saved recipes",
      "Full access to all features",
      "Priority support",
    ],
  },
  LIFETIME: {
    name: "Lifetime",
    tagline: "Pay once, use forever",
    price: "$50",
    period: "one-time",
    priceOneTime: 5000,
    mode: "payment",
    priceId: process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID ?? process.env.STRIPE_LIFETIME_PRICE_ID ?? "",
    features: [
      "Everything in Pro, forever",
      "Unlimited extractions",
      "One payment — no subscription",
      "All future features included",
    ],
  },
} as const;

/** Price IDs that grant lifetime access, checked server-side in the webhook. */
export const LIFETIME_PRICE_IDS = [
  process.env.STRIPE_LIFETIME_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID,
].filter(Boolean) as string[];
