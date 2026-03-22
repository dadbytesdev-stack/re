"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { RecipeResult } from "./RecipeResult";

interface ExtractedRecipe {
  id?: string;
  title: string;
  image?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  ingredients: string[];
  instructions: string[];
  sourceUrl: string;
  isSaved?: boolean;
}

interface ExtractorProps {
  initialUrl?: string;
  onSaveChange?: () => void;
}

export function RecipeExtractor({ initialUrl = "", onSaveChange }: ExtractorProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<ExtractedRecipe | null>(null);
  const [requiresSignup, setRequiresSignup] = useState(false);
  const [isLimitError, setIsLimitError] = useState(false);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setRecipe(null);
    setRequiresSignup(false);
    setIsLimitError(false);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requiresSignup) {
          setRequiresSignup(true);
          setIsLimitError(true);
          setError(data.message ?? "Please sign up to continue.");
          return;
        }
        if (res.status === 403 && data.tier) {
          setIsLimitError(true);
          setError(data.message ?? "Monthly limit reached.");
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setRecipe(data.recipe);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* URL Input Form */}
      <form onSubmit={handleExtract} className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.allrecipes.com/recipe/..."
          className="input flex-1"
          disabled={loading}
          required
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="btn-primary whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Extracting…
            </span>
          ) : (
            "Extract Recipe"
          )}
        </button>
      </form>

      {/* Error / Upsell Banner */}
      {error && (
        <div className={`rounded-xl p-4 text-sm ${requiresSignup ? "bg-brand-50 border border-brand-200" : "bg-red-50 border border-red-200"}`}>
          <p className={requiresSignup ? "text-brand-800 font-medium" : "text-red-700"}>
            {error}
          </p>
          {requiresSignup && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => router.push("/signup")}
                className="btn-primary text-xs"
              >
                Sign up free
              </button>
              <button
                onClick={() => router.push("/login")}
                className="btn-secondary text-xs"
              >
                Sign in
              </button>
            </div>
          )}
          {!requiresSignup && isLimitError && (
            <p className="mt-1 text-gray-500">
              <a href="/pricing" className="underline hover:text-gray-700">View plans</a> to unlock more extractions.
            </p>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="card animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-100 rounded w-full" />
            ))}
          </div>
        </div>
      )}

      {/* Recipe Result */}
      {recipe && !loading && <RecipeResult recipe={recipe} onSaveChange={onSaveChange} />}
    </div>
  );
}
