import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractRecipe } from "@/lib/recipe-extractor";
import { canExtract, incrementUsage } from "@/lib/usage";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const extractSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

// Track guest extractions by IP (simple, reset on server restart)
const guestUsage = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = extractSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { url } = result.data;
    const session = await getServerSession(authOptions);

    // ── Guest (unauthenticated) ────────────────────────────────────────────
    if (!session?.user) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
      const uses = guestUsage.get(ip) ?? 0;

      if (uses >= 1) {
        return NextResponse.json(
          {
            error: "Guest limit reached",
            requiresSignup: true,
            message:
              "You've used your 1 free extraction. Sign up for more!",
          },
          { status: 403 }
        );
      }

      const recipe = await extractRecipe(url);
      guestUsage.set(ip, uses + 1);

      return NextResponse.json({ recipe, isGuest: true });
    }

    // ── Authenticated user ─────────────────────────────────────────────────
    const userId = session.user.id;
    const { allowed, used, limit, tier } = await canExtract(userId);

    if (!allowed) {
      return NextResponse.json(
        {
          error: "Monthly limit reached",
          used,
          limit,
          tier,
          message:
            tier === "FREE"
              ? "Upgrade to Premium for 10 extractions/month."
              : "Upgrade to Pro for unlimited extractions.",
        },
        { status: 403 }
      );
    }

    const recipe = await extractRecipe(url);

    // Save to DB
    const saved = await prisma.recipe.create({
      data: {
        userId,
        title: recipe.title,
        sourceUrl: recipe.sourceUrl,
        image: recipe.image,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        isSaved: tier !== "FREE",
      },
    });

    await incrementUsage(userId);

    return NextResponse.json({ recipe: { ...recipe, id: saved.id } });
  } catch (error) {
    console.error("[extract]", error);
    const message =
      error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
