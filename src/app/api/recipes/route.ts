import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/recipes — list saved recipes for the authenticated user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const skip = (page - 1) * limit;

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId: session.user.id, isSaved: true },
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
        createdAt: true,
      },
    }),
    prisma.recipe.count({
      where: { userId: session.user.id, isSaved: true },
    }),
  ]);

  return NextResponse.json({
    recipes,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
