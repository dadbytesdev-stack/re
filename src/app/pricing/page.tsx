"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PLANS } from "@/lib/stripe";
import Link from "next/link";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    description: "Try it out",
    features: [
      "1 free extraction (no account required)",
      "Instant results",
    ],
    cta: "Get started",
    ctaHref: "/signup",
    highlight: false,
    tier: "FREE" as const,
  },
  {
    name: PLANS.PREMIUM.name,
    price: PLANS.PREMIUM.price,
    description: "For regular cooks",
    features: PLANS.PREMIUM.features,
    cta: "Upgrade to Premium",
    priceId: PLANS.PREMIUM.priceId,
    highlight: true,
    tier: "PREMIUM" as const,
    badge: "Most Popular",
  },
  {
    name: PLANS.PRO.name,
    price: PLANS.PRO.price,
    description: "For power users",
    features: PLANS.PRO.features,
    cta: "Upgrade to Pro",
    priceId: PLANS.PRO.priceId,
    highlight: false,
    tier: "PRO" as const,
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  async function handleUpgrade(priceId: string) {
    if (!session?.user) {
      router.push("/signup");
      return;
    }

    setLoadingPriceId(priceId);

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingPriceId(null);
    }
  }

  const currentTier = session?.user?.tier ?? "FREE";

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-gray-900">Simple pricing</h1>
            <p className="text-gray-500 max-w-lg mx-auto">
              Start free. Upgrade when you need more. No hidden fees, cancel anytime.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid sm:grid-cols-3 gap-6">
            {TIERS.map((tier) => {
              const isCurrentPlan = currentTier === tier.tier;
              const isLoading = loadingPriceId === tier.priceId;

              return (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl p-6 flex flex-col gap-6 ${
                    tier.highlight
                      ? "bg-brand-500 text-white shadow-xl shadow-brand-200"
                      : "bg-white border border-gray-100 shadow-sm"
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full">
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className={`font-semibold text-sm ${tier.highlight ? "text-brand-100" : "text-gray-500"}`}>
                      {tier.description}
                    </p>
                    <h2 className={`text-2xl font-bold mt-1 ${tier.highlight ? "text-white" : "text-gray-900"}`}>
                      {tier.name}
                    </h2>
                    <div className="flex items-end gap-1 mt-2">
                      <span className={`text-4xl font-bold ${tier.highlight ? "text-white" : "text-gray-900"}`}>
                        {tier.price}
                      </span>
                      {tier.price !== "$0" && (
                        <span className={`text-sm mb-1 ${tier.highlight ? "text-brand-100" : "text-gray-400"}`}>
                          /month
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-sm">
                        <span className={tier.highlight ? "text-brand-200" : "text-brand-500"}>✓</span>
                        <span className={tier.highlight ? "text-brand-50" : "text-gray-600"}>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrentPlan ? (
                    <div className={`text-center text-sm font-medium rounded-xl py-2.5 ${tier.highlight ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                      Current plan
                    </div>
                  ) : tier.priceId ? (
                    <button
                      onClick={() => handleUpgrade(tier.priceId!)}
                      disabled={isLoading}
                      className={`rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                        tier.highlight
                          ? "bg-white text-brand-600 hover:bg-brand-50"
                          : "bg-brand-500 text-white hover:bg-brand-600"
                      }`}
                    >
                      {isLoading ? "Redirecting…" : tier.cta}
                    </button>
                  ) : (
                    <Link
                      href={tier.ctaHref ?? "/signup"}
                      className={`text-center rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                        tier.highlight
                          ? "bg-white text-brand-600 hover:bg-brand-50"
                          : "bg-brand-500 text-white hover:bg-brand-600"
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-gray-900 text-center">FAQ</h2>
            {[
              {
                q: "Do I need a credit card for the free plan?",
                a: "No. You can extract 1 recipe without even creating an account.",
              },
              {
                q: "What counts as an extraction?",
                a: "Each time you paste a URL and get a clean recipe result, that's one extraction. Your counter resets monthly.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel from your billing dashboard with one click. Your plan stays active until the end of the billing period.",
              },
              {
                q: "What recipe sites are supported?",
                a: "Any site that uses standard recipe markup (AllRecipes, NYT Cooking, Food Network, etc.) works automatically. Other sites fall back to our AI extractor.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-100 pb-4">
                <p className="font-semibold text-gray-900 text-sm">{q}</p>
                <p className="text-sm text-gray-500 mt-1">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
