"use client";

import { useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { PLANS } from "@/lib/stripe";
import { isKnownPriceId, signupUrlForPrice } from "@/lib/checkout-intent";
import Link from "next/link";

function Features({ items, tone }: { items: readonly string[]; tone: "light" | "dark" }) {
  return (
    <ul className="space-y-2 flex-1">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm">
          <span className={tone === "dark" ? "text-brand-200" : "text-brand-500"}>✓</span>
          <span className={tone === "dark" ? "text-brand-50" : "text-gray-600"}>{f}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleUpgrade = useCallback(
    async (priceId: string) => {
      // An unset NEXT_PUBLIC price id would otherwise post an empty string and
      // come back as a bare "Invalid price ID".
      if (!priceId) {
        setCheckoutError(
          "That plan isn't available right now. Please try again in a moment."
        );
        return;
      }

      /* A signed-out click still carries intent. Send the chosen plan and the
       * return path into signup so checkout picks up where it left off, instead
       * of dropping the person on /dashboard to start over. */
      if (!session?.user) {
        router.push(signupUrlForPrice(priceId));
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
    },
    [session, router]
  );

  /* Returning from /signup?callbackUrl=/pricing&priceId=… : open Stripe straight
   * away rather than asking for the same click twice. Limited to a FREE account
   * so a stale or shared link can never re-charge someone who already paid. */
  const resumePriceId = searchParams.get("priceId");
  const resumedRef = useRef(false);

  useEffect(() => {
    if (resumedRef.current) return;
    if (status !== "authenticated") return;
    if (!isKnownPriceId(resumePriceId)) return;
    if ((session?.user?.tier ?? "FREE") !== "FREE") return;

    resumedRef.current = true;
    // Drop the parameter first so a refresh or a back-navigation does not open
    // checkout a second time.
    router.replace("/pricing", { scroll: false });
    handleUpgrade(resumePriceId);
  }, [status, session, resumePriceId, router, handleUpgrade]);

  const currentTier = session?.user?.tier ?? "FREE";
  const signedIn = Boolean(session?.user);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-16 px-4">
        <div className="max-w-6xl mx-auto space-y-12">

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
              Ten free extractions every month, just for signing in. Upgrade when you
              need more. No hidden fees, cancel anytime.
            </p>
          </div>

          {/* Sign-in nudge — only shown to signed-out visitors */}
          {!signedIn && (
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 text-center space-y-3 max-w-2xl mx-auto">
              <p className="font-semibold text-brand-800">
                Make sure you sign in to save! Don&apos;t lose your recipes!
              </p>
              <p className="text-sm text-brand-700">
                You get 1 extraction without an account. Sign in and that becomes 10 a
                month — and every recipe you extract stays in your account.
              </p>
              <Link href="/signup" className="btn-primary text-sm inline-block">
                Sign up free
              </Link>
            </div>
          )}

          {/* Pricing cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">

            {/* Free */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <p className="font-semibold text-sm text-gray-500">{PLANS.FREE.tagline}</p>
                <h2 className="text-2xl font-bold mt-1 text-gray-900">{PLANS.FREE.name}</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-gray-900">{PLANS.FREE.price}</span>
                  <span className="text-sm mb-1 text-gray-400">{PLANS.FREE.period}</span>
                </div>
              </div>

              <Features items={PLANS.FREE.features} tone="light" />

              <p className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                Make sure you sign in to save! Don&apos;t lose your recipes!
              </p>

              {currentTier === "FREE" && signedIn ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-gray-100 text-gray-500">
                  Current plan
                </div>
              ) : signedIn ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-gray-50 text-gray-400">
                  Included in your plan
                </div>
              ) : (
                <Link href="/signup" className="text-center rounded-xl py-2.5 text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors">
                  Get started free
                </Link>
              )}
            </div>

            {/* Premium */}
            <div className="relative bg-brand-500 rounded-2xl p-6 flex flex-col gap-6 shadow-xl shadow-brand-200">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm text-brand-100">{PLANS.PREMIUM.tagline}</p>
                <h2 className="text-2xl font-bold mt-1 text-white">{PLANS.PREMIUM.name}</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-white">{PLANS.PREMIUM.price}</span>
                  <span className="text-sm mb-1 text-brand-100">{PLANS.PREMIUM.period}</span>
                </div>
              </div>

              <Features items={PLANS.PREMIUM.features} tone="dark" />

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
                <p className="font-semibold text-sm text-gray-500">{PLANS.PRO.tagline}</p>
                <h2 className="text-2xl font-bold mt-1 text-gray-900">{PLANS.PRO.name}</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-gray-900">{PLANS.PRO.price}</span>
                  <span className="text-sm mb-1 text-gray-400">{PLANS.PRO.period}</span>
                </div>
              </div>

              <Features items={PLANS.PRO.features} tone="light" />

              {currentTier === "PRO" ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-gray-100 text-gray-500">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(PLANS.PRO.priceId)}
                  disabled={loadingPriceId === PLANS.PRO.priceId}
                  className="rounded-xl py-2.5 text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-60"
                >
                  {loadingPriceId === PLANS.PRO.priceId ? "Redirecting…" : "Upgrade to Pro"}
                </button>
              )}
            </div>

            {/* Lifetime */}
            <div className="relative bg-gray-900 rounded-2xl p-6 flex flex-col gap-6 shadow-xl shadow-gray-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-emerald-400 text-emerald-950 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                  Best Value
                </span>
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-400">{PLANS.LIFETIME.tagline}</p>
                <h2 className="text-2xl font-bold mt-1 text-white">{PLANS.LIFETIME.name}</h2>
                <div className="flex items-end gap-1 mt-2">
                  <span className="text-4xl font-bold text-white">{PLANS.LIFETIME.price}</span>
                  <span className="text-sm mb-1 text-gray-400">{PLANS.LIFETIME.period}</span>
                </div>
                <p className="text-xs text-emerald-400 font-medium mt-1">
                  No subscription — pay once, use forever.
                </p>
              </div>

              <ul className="space-y-2 flex-1">
                {PLANS.LIFETIME.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>

              {currentTier === "LIFETIME" ? (
                <div className="text-center text-sm font-medium rounded-xl py-2.5 bg-white/10 text-white">
                  You own this
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(PLANS.LIFETIME.priceId)}
                  disabled={loadingPriceId === PLANS.LIFETIME.priceId}
                  className="rounded-xl py-2.5 text-sm font-semibold bg-emerald-400 text-emerald-950 hover:bg-emerald-300 transition-colors disabled:opacity-60"
                >
                  {loadingPriceId === PLANS.LIFETIME.priceId ? "Redirecting…" : "Buy Lifetime"}
                </button>
              )}
            </div>

          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-gray-900 text-center">FAQ</h2>
            {[
              {
                q: "Do I need an account to try it?",
                a: "No. You get 1 extraction without an account. Sign in — it's free — and you get 10 every month, plus your recipes are saved instead of disappearing when you close the tab.",
              },
              {
                q: "Can I really save recipes on the free plan?",
                a: "Yes. Saving is included free once you're signed in. Premium and Pro raise how many recipes you can extract each month, not whether you can keep them.",
              },
              {
                q: "What counts as an extraction?",
                a: "Each time you paste a URL and get a clean recipe result, that's one extraction. Your counter resets monthly.",
              },
              {
                q: "What does Lifetime include?",
                a: "Everything in Pro — unlimited extractions and every feature — for a single $50 payment. There's no renewal and nothing to cancel.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Cancel Premium or Pro from your billing dashboard with one click; your plan stays active until the end of the billing period. Lifetime has nothing to cancel.",
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

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}
