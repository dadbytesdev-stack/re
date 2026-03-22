import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export const PLANS = {
  PREMIUM: {
    name: "Premium",
    price: "$4.99",
    priceMonthly: 499,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID ?? process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? "",
    features: [
      "10 recipe extractions / month",
      "Save recipe history",
      "Access previously extracted recipes",
    ],
  },
  PRO: {
    name: "Pro",
    price: "$9.99",
    priceMonthly: 999,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
    priceYearlyId: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID ?? process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? "",
    features: [
      "Unlimited extractions",
      "Unlimited saved recipes",
      "Full access to all features",
      "Priority support",
    ],
  },
} as const;
