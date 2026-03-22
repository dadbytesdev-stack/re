import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/recipes?type=saved|history&page=1&limit=10
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "saved"; // "saved" | "history"
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "10", 10));
  const skip = (page - 1) * limit;

  // History = all recipes (saved or not), capped at 10 most recent
  // Saved = only isSaved: true
  const where =
    type === "history"
      ? { userId: session.user.id }
      : { userId: session.user.id, isSaved: true };

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        image: true,
        prepTime: true,
        cookTime: true,
        servings: true,
        isSaved: true,
        createdAt: true,
      },
    }),
    // History is capped at 10 total displayed
    type === "history"
      ? Promise.resolve(Math.min(10, await prisma.recipe.count({ where })))
      : prisma.recipe.count({ where }),
  ]);

  // For history, only return up to 10 total regardless of pagination
  const effectiveTotal = type === "history" ? Math.min(total, 10) : total;

  return NextResponse.json({
    recipes,
    pagination: {
      page,
      limit,
      total: effectiveTotal,
      pages: Math.ceil(effectiveTotal / limit),
    },
  });
}
