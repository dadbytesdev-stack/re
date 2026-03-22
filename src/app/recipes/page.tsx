"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import Link from "next/link";
import Image from "next/image";

interface Recipe {
  id: string;
  title: string;
  sourceUrl: string;
  image?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  servings?: string | null;
  isSaved: boolean;
  createdAt: string;
}

type Tab = "saved" | "history";

export default function RecipesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("saved");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/recipes");
    }
  }, [status, router]);

  const fetchRecipes = useCallback(async (t: Tab, p: number) => {
    setLoading(true);
    const res = await fetch(`/api/recipes?type=${t}&page=${p}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      setRecipes(data.recipes);
      setTotalPages(data.pagination.pages || 1);
      setTotal(data.pagination.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchRecipes(tab, page);
    }
  }, [status, tab, page, fetchRecipes]);

  function handleTabChange(t: Tab) {
    setTab(t);
    setPage(1);
  }

  async function handleToggleSave(recipe: Recipe) {
    setSavingId(recipe.id);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setRecipes((prev) =>
          prev.map((r) => (r.id === recipe.id ? { ...r, isSaved: data.isSaved } : r))
        );
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recipe from your history?")) return;
    const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    }
  }

  const canSave = session?.user?.tier === "PREMIUM" || session?.user?.tier === "PRO";

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">My Recipes</h1>
          </div>
          <Link href="/dashboard" className="btn-primary text-sm">
            + Extract New
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["saved", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "saved" ? "Saved" : "History"}
              {t === "history" && (
                <span className="ml-1.5 text-xs text-gray-400">(last 10)</span>
              )}
            </button>
          ))}
        </div>

        {/* Upgrade prompt for free users on saved tab */}
        {tab === "saved" && !canSave && (
          <div className="card bg-brand-50 border-brand-200 text-center space-y-2 py-8">
            <p className="text-2xl">🔒</p>
            <p className="font-semibold text-brand-800">Save recipes with Premium</p>
            <p className="text-sm text-brand-700">Upgrade to save and revisit your favourite extractions.</p>
            <Link href="/pricing" className="btn-primary text-sm inline-block mt-2">
              View plans
            </Link>
          </div>
        )}

        {/* Recipe list */}
        {(tab === "history" || canSave) && (
          <>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="card animate-pulse h-24" />
                ))}
              </div>
            ) : recipes.length === 0 ? (
              <div className="card text-center py-16 space-y-3">
                <p className="text-4xl">{tab === "saved" ? "📚" : "🕑"}</p>
                <p className="font-semibold text-gray-700">
                  {tab === "saved" ? "No saved recipes yet" : "No history yet"}
                </p>
                <p className="text-sm text-gray-400">
                  {tab === "saved"
                    ? "Extract a recipe and hit Save to keep it here."
                    : "Your extraction history will appear here."}
                </p>
                <Link href="/dashboard" className="btn-primary text-sm inline-block">
                  Extract a recipe
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recipes.map((recipe) => (
                  <RecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    canSave={canSave}
                    saving={savingId === recipe.id}
                    onToggleSave={() => handleToggleSave(recipe)}
                    onDelete={() => handleDelete(recipe.id)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3 pt-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn-secondary text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {total} total
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
      </main>
    </>
  );
}

function RecipeRow({
  recipe,
  canSave,
  saving,
  onToggleSave,
  onDelete,
}: {
  recipe: Recipe;
  canSave: boolean;
  saving: boolean;
  onToggleSave: () => void;
  onDelete: () => void;
}) {
  const date = new Date(recipe.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="card flex items-center gap-4 group hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
        {recipe.image ? (
          <Image src={recipe.image} alt={recipe.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full text-xl">🍳</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/recipe/${recipe.id}`}
          className="font-semibold text-gray-900 hover:text-brand-600 transition-colors text-sm line-clamp-1"
        >
          {recipe.title}
        </Link>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">{date}</span>
          {recipe.prepTime && <span className="text-xs text-gray-400">⏱ {recipe.prepTime}</span>}
          {recipe.cookTime && <span className="text-xs text-gray-400">🔥 {recipe.cookTime}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {canSave && (
          <button
            onClick={onToggleSave}
            disabled={saving}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              recipe.isSaved
                ? "bg-brand-100 text-brand-700 hover:bg-red-50 hover:text-red-600"
                : "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-600"
            }`}
          >
            {saving ? "…" : recipe.isSaved ? "✓ Saved" : "🔖 Save"}
          </button>
        )}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
