"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  limit: number;
  tier: "FREE" | "PREMIUM" | "PRO";
}

function DashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get("success") === "true";

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
    const res = await fetch(`/api/recipes?page=${p}&limit=12`);
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
  const canSave = tier === "PREMIUM" || tier === "PRO";

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Upgrade success banner */}
        {justUpgraded && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 font-medium">
            🎉 Your plan has been upgraded! Enjoy your new features.
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
                  Upgrade to Premium for 10/month or Pro for unlimited access.
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
              <RecipeExtractor />
            </div>

            {/* Saved Recipes */}
            {canSave && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Saved Recipes</h2>
                  <span className="text-xs text-gray-400">{recipes.length} saved</span>
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
                      {recipes.map((recipe) => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          onDelete={handleDeleteRecipe}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                          className="btn-secondary text-xs disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-gray-500 self-center">
                          Page {page} of {totalPages}
                        </span>
                        <button
                          disabled={page === totalPages}
                          onClick={() => setPage((p) => p + 1)}
                          className="btn-secondary text-xs disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    )}
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
