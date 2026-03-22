"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PLANS } from "@/lib/stripe";
import Link from "next/link";

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [proYearly, setProYearly] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleUpgrade(priceId: string) {
    if (!session?.user) {
      router.push("/signup");
      return;
    }

    setLoadingPriceId(priceId);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error ?? "Failed to start checkout. Please try again.");
      }
    } catch {
      setCheckoutError("Network error. Please check your connection and try again.");
    } finally {
      setLoadingPriceId(null);
    }
  }

  const currentTier = session?.user?.tier ?? "FREE";
  const proActivePriceId = proYearly ? PLANS.PRO.priceYearlyId : PLANS.PRO.priceId;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-12">

          {/* Checkout error */}
          {checkoutError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-center">
              {checkoutError}
            </div>
          )}

          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-gray-900">Simple pricing</h1>
            <p className="text-gray-500 max-w-lg mx-auto">
              Start free. Upgrade when you need more. No hidden fees, cancel anytime.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid sm:grid-cols-3 gap-6">

            {/* Free */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <p className="font-semibold text-sm text-gray-500">Try it out</p>
                <h2 className="text-2xl font-bold mt-1 text-gray-900">Free</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {["1 free extraction (no account required)", "Instant results"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-brand-500">✓</span>
                    <span className="text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>
              {currentTier === "FREE" ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-gray-100 text-gray-500">
                  Current plan
                </div>
              ) : (
                <Link href="/signup" className="text-center rounded-xl py-2.5 text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors">
                  Get started
                </Link>
              )}
            </div>

            {/* Premium */}
            <div className="relative bg-brand-500 rounded-2xl p-6 flex flex-col gap-6 shadow-xl shadow-brand-200">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm text-brand-100">For regular cooks</p>
                <h2 className="text-2xl font-bold mt-1 text-white">{PLANS.PREMIUM.name}</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-white">{PLANS.PREMIUM.price}</span>
                  <span className="text-sm mb-1 text-brand-100">/month</span>
                </div>
              </div>
              <ul className="space-y-2 flex-1">
                {PLANS.PREMIUM.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-brand-200">✓</span>
                    <span className="text-brand-50">{f}</span>
                  </li>
                ))}
              </ul>
              {currentTier === "PREMIUM" ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-white/20 text-white">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(PLANS.PREMIUM.priceId)}
                  disabled={loadingPriceId === PLANS.PREMIUM.priceId}
                  className="rounded-xl py-2.5 text-sm font-semibold bg-white text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-60"
                >
                  {loadingPriceId === PLANS.PREMIUM.priceId ? "Redirecting…" : "Upgrade to Premium"}
                </button>
              )}
            </div>

            {/* Pro */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <p className="font-semibold text-sm text-gray-500">For power users</p>
                <h2 className="text-2xl font-bold mt-1 text-gray-900">{PLANS.PRO.name}</h2>

                {/* Monthly / Yearly toggle */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => setProYearly(false)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                      !proYearly ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setProYearly(true)}
                    className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                      proYearly ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    Yearly
                    <span className={`text-xs font-bold ${proYearly ? "text-amber-300" : "text-green-600"}`}>
                      Save 17%
                    </span>
                  </button>
                </div>

                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-gray-900">
                    {proYearly ? "$99.99" : PLANS.PRO.price}
                  </span>
                  <span className="text-sm mb-1 text-gray-400">
                    {proYearly ? "/year" : "/month"}
                  </span>
                </div>
                {proYearly && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    That&apos;s $8.33/month — 2 months free!
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1">
                {PLANS.PRO.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-brand-500">✓</span>
                    <span className="text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>

              {currentTier === "PRO" ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-gray-100 text-gray-500">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(proActivePriceId)}
                  disabled={loadingPriceId === proActivePriceId}
                  className="rounded-xl py-2.5 text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
                >
                  {loadingPriceId === proActivePriceId ? "Redirecting…" : `Upgrade to Pro`}
                </button>
              )}
            </div>

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
