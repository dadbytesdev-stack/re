"use client";

import Link from "next/link";
import Image from "next/image";

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    sourceUrl: string;
    image?: string | null;
    prepTime?: string | null;
    cookTime?: string | null;
    servings?: string | null;
    createdAt: string | Date;
  };
  onDelete?: (id: string) => void;
}

export function RecipeCard({ recipe, onDelete }: RecipeCardProps) {
  const date = new Date(recipe.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="card group hover:shadow-md transition-shadow flex gap-4">
      {/* Thumbnail */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
        {recipe.image ? (
          <Image
            src={recipe.image}
            alt={recipe.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-2xl">🍳</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/recipe/${recipe.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors line-clamp-2 text-sm">
          {recipe.title}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">{date}</p>

        <div className="flex flex-wrap gap-2 mt-2">
          {recipe.prepTime && (
            <span className="text-xs text-gray-500">⏱ {recipe.prepTime}</span>
          )}
          {recipe.cookTime && (
            <span className="text-xs text-gray-500">🔥 {recipe.cookTime}</span>
          )}
          {recipe.servings && (
            <span className="text-xs text-gray-500">🍽 {recipe.servings}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {onDelete && (
        <button
          onClick={() => onDelete(recipe.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 self-start mt-1"
          title="Delete recipe"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
