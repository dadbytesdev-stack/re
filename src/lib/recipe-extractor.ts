/**
 * Recipe Extractor
 *
 * Strategy:
 * 1. Try to parse JSON-LD / schema.org Recipe markup (fast, no AI needed)
 * 2. Fall back to OpenAI GPT to extract ingredients + instructions from raw HTML
 */

import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
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
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

function truncate(html: string) {
  return html.length > 2_000_000 ? html.slice(0, 2_000_000) : html;
}

async function fetchHtml(url: string): Promise<string> {
  // ── Attempt 1: direct fetch ──────────────────────────────────────────────
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      cache: "no-store",
    });

    if (res.ok) {
      return truncate(await res.text());
    }

    // Only fall through to ScraperAPI on bot-block status codes
    if (![402, 403, 429, 503].includes(res.status)) {
      throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    if ((err as Error).message.startsWith("Failed to fetch URL:")) throw err;
    // Network/other error — try ScraperAPI
  }

  // ── Attempt 2: ScraperAPI without JS rendering (fast, ~3-5s) ─────────────
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    throw new Error("Unable to fetch this page. Add a SCRAPER_API_KEY to enable access to protected sites.");
  }

  const scraperUrlFast = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
  const scraperResFast = await fetch(scraperUrlFast, { cache: "no-store" });

  if (scraperResFast.ok) {
    const html = truncate(await scraperResFast.text());
    // Only accept if it has actual recipe content (not a JS-gated blank page)
    if (html.length > 5000) return html;
  }

  // ── Attempt 3: ScraperAPI with JS rendering (slow, ~15-25s) ──────────────
  const scraperUrlRender = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;
  const scraperResRender = await fetch(scraperUrlRender, { cache: "no-store" });

  if (!scraperResRender.ok) {
    throw new Error(`Unable to fetch this recipe page (${scraperResRender.status}). The site may be blocking access.`);
  }

  return truncate(await scraperResRender.text());
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

  scripts.each((_: number, el: DomElement) => {
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
