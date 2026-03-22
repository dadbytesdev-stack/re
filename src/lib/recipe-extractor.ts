/**
 * Recipe Extractor
 *
 * Strategy:
 * 1. Try to parse JSON-LD / schema.org Recipe markup (fast, no AI needed)
 * 2. Fall back to OpenAI GPT to extract ingredients + instructions from raw HTML
 */

import * as cheerio from "cheerio";
import OpenAI from "openai";

export interface ExtractedRecipe {
  title: string;
  image?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  ingredients: string[];
  instructions: string[];
  sourceUrl: string;
}

// ─────────────────────────────────────────────
// Step 1 — Fetch page HTML
// ─────────────────────────────────────────────
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RecipeExtractorBot/1.0; +https://recipeextractor.app)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  if (html.length > 2_000_000) {
    // Truncate very large pages to keep token count manageable
    return html.slice(0, 2_000_000);
  }
  return html;
}

// ─────────────────────────────────────────────
// Step 2 — Try schema.org JSON-LD parsing
// ─────────────────────────────────────────────
interface SchemaRecipe {
  "@type"?: string | string[];
  name?: string;
  image?: string | { url?: string } | Array<string | { url?: string }>;
  prepTime?: string;
  cookTime?: string;
  recipeYield?: string | string[];
  recipeIngredient?: string[];
  recipeInstructions?:
    | string
    | string[]
    | Array<{ "@type"?: string; text?: string; name?: string }>;
}

function parseJsonLd(html: string): ExtractedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  let recipeSchema: SchemaRecipe | null = null;

  scripts.each((_: number, el: cheerio.Element) => {
    try {
      const json = JSON.parse($(el).html() || "{}");
      const candidates: SchemaRecipe[] = Array.isArray(json)
        ? json
        : json["@graph"]
        ? json["@graph"]
        : [json];

      for (const item of candidates) {
        const type = item["@type"];
        const isRecipe = Array.isArray(type)
          ? type.includes("Recipe")
          : type === "Recipe";
        if (isRecipe) {
          recipeSchema = item;
          return false; // break
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  if (!recipeSchema) return null;

  const schema = recipeSchema as SchemaRecipe;

  // Extract image URL
  let image: string | undefined;
  if (typeof schema.image === "string") {
    image = schema.image;
  } else if (Array.isArray(schema.image)) {
    const first = schema.image[0];
    image = typeof first === "string" ? first : first?.url;
  } else if (schema.image && typeof schema.image === "object") {
    image = (schema.image as { url?: string }).url;
  }

  // Extract instructions as plain strings
  const rawInstructions = schema.recipeInstructions;
  let instructions: string[] = [];
  if (typeof rawInstructions === "string") {
    instructions = rawInstructions
      .split(/\n|\.(?=\s)/)
      .map((s: string) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(rawInstructions)) {
    instructions = (rawInstructions as Array<string | { text?: string; name?: string }>)
      .map((item) =>
        typeof item === "string" ? item : item.text || item.name || ""
      )
      .filter(Boolean);
  }

  const yield_ = schema.recipeYield;

  return {
    title: schema.name || "Untitled Recipe",
    image,
    prepTime: schema.prepTime,
    cookTime: schema.cookTime,
    servings: Array.isArray(yield_) ? yield_[0] : yield_,
    ingredients: schema.recipeIngredient || [],
    instructions,
    sourceUrl: "",
  };
}

// ─────────────────────────────────────────────
// Step 3 — OpenAI fallback
// ─────────────────────────────────────────────
async function extractWithAI(html: string, url: string): Promise<ExtractedRecipe> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Please add your key to .env.local to enable AI extraction."
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Strip HTML tags and collapse whitespace for a cleaner prompt
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, aside, .ad, .advertisement").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a recipe extraction assistant. Given the text content of a recipe web page, extract ONLY the recipe data. Return a JSON object with these fields:
- title (string): the recipe name
- prepTime (string | null): preparation time
- cookTime (string | null): cooking time
- servings (string | null): yield / servings
- ingredients (string[]): list of ingredients with amounts and units
- instructions (string[]): ordered list of step-by-step directions

Return ONLY the raw recipe content. Do NOT include blog text, stories, comments, or ads.`,
      },
      {
        role: "user",
        content: `Extract the recipe from this page (URL: ${url}):\n\n${text}`,
      },
    ],
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  const parsed = JSON.parse(content);

  return {
    title: parsed.title || "Untitled Recipe",
    prepTime: parsed.prepTime || undefined,
    cookTime: parsed.cookTime || undefined,
    servings: parsed.servings || undefined,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    sourceUrl: url,
  };
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────
export async function extractRecipe(url: string): Promise<ExtractedRecipe> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid URL provided");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  const html = await fetchHtml(url);

  // Try structured data first (no API call needed)
  const schemaResult = parseJsonLd(html);
  if (
    schemaResult &&
    schemaResult.ingredients.length > 0 &&
    schemaResult.instructions.length > 0
  ) {
    schemaResult.sourceUrl = url;
    return schemaResult;
  }

  // Fall back to OpenAI
  return extractWithAI(html, url);
}
