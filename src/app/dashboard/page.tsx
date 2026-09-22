"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSession, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { RecipeExtractor } from "@/components/RecipeExtractor";
import { RecipeCard } from "@/components/RecipeCard";
import { UsageCounter } from "@/components/UsageCounter";
import Link from "next/link";
import { Suspense } from "react";

interface SavedRecipe {
  id: string;
  title: string;
  sourceUrl: string;
  image?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  createdAt: string;
}

interface UsageData {
  used: number;
  /** null means unlimited — see /api/user/usage. */
  limit: number | null;
  tier: "FREE" | "PREMIUM" | "PRO" | "LIFETIME";
}

type UpgradeState = "idle" | "activating" | "done" | "slow";

const TIER_LABELS: Record<UsageData["tier"], string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  PRO: "Pro",
  LIFETIME: "Lifetime",
};

/** Roughly 18s of polling — long enough for a slow webhook, short enough to bail. */
const UPGRADE_POLL_ATTEMPTS = 12;
const UPGRADE_POLL_INTERVAL_MS = 1500;

function DashboardContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get("success") === "true";

  /* NextAuth's `update` bails out early when it closes over a session that was
   * still null, so the poll below must always call the current render's copy
   * rather than the one captured when the effect mounted. */
  const updateRef = useRef(update);
  updateRef.current = update;

  const [upgradeState, setUpgradeState] = useState<UpgradeState>(
    justUpgraded ? "activating" : "idle"
  );
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/dashboard");
    }
  }, [status, router]);

  const fetchUsage = useCallback(async () => {
    const res = await fetch("/api/user/usage");
    if (res.ok) {
      const data = await res.json();
      setUsage(data);
    }
  }, []);

  const fetchRecipes = useCallback(async (p: number) => {
    setLoadingRecipes(true);
    const res = await fetch(`/api/recipes?type=saved&page=${p}&limit=5`);
    if (res.ok) {
      const data = await res.json();
      setRecipes(data.recipes);
      setTotalPages(data.pagination.pages);
    }
    setLoadingRecipes(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsage();
      fetchRecipes(page);
    }
  }, [status, page, fetchUsage, fetchRecipes]);

  /* Stripe redirects here the moment payment completes, which can beat the
   * webhook that actually applies the new tier. Refreshing the session once
   * would often read a tier that is still FREE, so poll until it lands. */
  useEffect(() => {
    if (!justUpgraded) return;

    let cancelled = false;

    async function settle() {
      setUpgradeState("done");
      await fetchUsage();
      router.replace("/dashboard", { scroll: false });
    }

    (async () => {
      for (let attempt = 0; attempt <= UPGRADE_POLL_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, UPGRADE_POLL_INTERVAL_MS));
          if (cancelled) return;
        }

        // getSession() always hits /api/auth/session, which re-reads the tier
        // from the database via the jwt callback.
        const refreshed = await getSession();
        if (cancelled) return;

        const tier = refreshed?.user?.tier;
        // A paid tier means the webhook has been applied. On the first pass a
        // tier that is already paid means there was never anything to wait for.
        if (tier && tier !== "FREE") {
          // Sync the provider so the rest of the page re-renders on the new tier.
          await updateRef.current();
          if (cancelled) return;
          await settle();
          return;
        }
      }

      if (!cancelled) setUpgradeState("slow");
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDeleteRecipe(id: string) {
    if (!confirm("Delete this recipe?")) return;
    const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      fetchUsage();
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tier = session!.user.tier;
  // Saving is included on every plan now — signing in is the only requirement.
  const canSave = true;

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Post-checkout activation banner */}
        {upgradeState === "activating" && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-800 font-medium flex items-center gap-3">
            <span className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full shrink-0" />
            Payment received — activating your plan…
          </div>
        )}
        {upgradeState === "done" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 font-medium">
            🎉 You&apos;re on {TIER_LABELS[tier]}! Enjoy your new features.
          </div>
        )}
        {upgradeState === "slow" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-medium">Payment received — your plan is taking a moment to activate.</p>
            <p className="mt-1">
              This usually clears on its own within a minute. Refresh the page, and if it
              still hasn&apos;t applied, get in touch and we&apos;ll sort it out.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="space-y-6">
            {/* Usage counter */}
            {usage && (
              <UsageCounter used={usage.used} limit={usage.limit} tier={usage.tier} />
            )}

            {/* Upgrade CTA */}
            {tier === "FREE" && (
              <div className="card bg-gradient-to-br from-brand-50 to-amber-50 border-brand-200 space-y-3">
                <p className="font-semibold text-brand-800 text-sm">Unlock more extractions</p>
                <p className="text-xs text-brand-700">
                  Upgrade to Premium for 20/month, or go unlimited with Pro or Lifetime.
                </p>
                <Link href="/pricing" className="btn-primary text-xs w-full text-center">
                  View plans
                </Link>
              </div>
            )}

            {/* Billing portal for paid users */}
            {tier !== "FREE" && (
              <button
                onClick={async () => {
                  const res = await fetch("/api/stripe/portal", { method: "POST" });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }}
                className="btn-secondary w-full text-sm"
              >
                Manage billing
              </button>
            )}
          </div>

          {/* Right column — extractor + saved recipes */}
          <div className="lg:col-span-2 space-y-8">
            {/* Extractor */}
            <div className="card space-y-4">
              <h2 className="font-bold text-gray-900">Extract a Recipe</h2>
              <RecipeExtractor onSaveChange={() => fetchRecipes(1)} />
            </div>

            {/* Saved Recipes */}
            {canSave && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Recently Saved</h2>
                  <Link href="/recipes" className="text-xs text-brand-500 font-semibold hover:underline">
                    View all →
                  </Link>
                </div>

                {loadingRecipes ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="card animate-pulse h-24" />
                    ))}
                  </div>
                ) : recipes.length === 0 ? (
                  <div className="card text-center text-gray-400 py-10">
                    <p className="text-3xl mb-2">📚</p>
                    <p className="text-sm">Your saved recipes will appear here.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {recipes.slice(0, 5).map((recipe) => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          onDelete={handleDeleteRecipe}
                        />
                      ))}
                    </div>
                    <Link href="/recipes" className="block text-center text-xs text-brand-500 font-semibold hover:underline mt-2">
                      View all saved recipes & history →
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
