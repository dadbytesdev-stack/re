"use client";

import Image from "next/image";
import { useState } from "react";

interface RecipeResultProps {
  recipe: {
    id?: string;
    title: string;
    image?: string;
    prepTime?: string;
    cookTime?: string;
    servings?: string;
    ingredients: string[];
    instructions: string[];
    sourceUrl: string;
  };
}

export function RecipeResult({ recipe }: RecipeResultProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  function copyToClipboard(text: string, section: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  }

  const ingredientText = recipe.ingredients.join("\n");
  const instructionText = recipe.instructions
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex gap-4">
          {recipe.image && (
            <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden">
              <Image
                src={recipe.image}
                alt={recipe.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{recipe.title}</h2>
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-500 hover:underline mt-1 block truncate"
            >
              {recipe.sourceUrl}
            </a>
            {/* Meta */}
            <div className="flex flex-wrap gap-3 mt-3">
              {recipe.prepTime && (
                <MetaBadge icon="⏱" label="Prep" value={recipe.prepTime} />
              )}
              {recipe.cookTime && (
                <MetaBadge icon="🔥" label="Cook" value={recipe.cookTime} />
              )}
              {recipe.servings && (
                <MetaBadge icon="🍽" label="Serves" value={recipe.servings} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Ingredients */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Ingredients
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({recipe.ingredients.length})
              </span>
            </h3>
            <button
              onClick={() => copyToClipboard(ingredientText, "ingredients")}
              className="text-xs text-brand-500 hover:text-brand-700 font-medium"
            >
              {copiedSection === "ingredients" ? "✓ Copied!" : "Copy all"}
            </button>
          </div>
          <ul className="space-y-1.5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-brand-400 mt-0.5 flex-shrink-0">•</span>
                <span>{ing}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Instructions
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({recipe.instructions.length} steps)
              </span>
            </h3>
            <button
              onClick={() => copyToClipboard(instructionText, "instructions")}
              className="text-xs text-brand-500 hover:text-brand-700 font-medium"
            >
              {copiedSection === "instructions" ? "✓ Copied!" : "Copy all"}
            </button>
          </div>
          <ol className="space-y-3">
            {recipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function MetaBadge({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
      <span>{icon}</span>
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}
