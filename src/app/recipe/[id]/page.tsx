import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { RecipeResult } from "@/components/RecipeResult";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const recipe = await prisma.recipe.findUnique({ where: { id } });

  if (!recipe || recipe.userId !== session.user.id) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ← Dashboard
          </Link>
        </div>

        <RecipeResult
          recipe={{
            id: recipe.id,
            title: recipe.title,
            image: recipe.image ?? undefined,
            prepTime: recipe.prepTime ?? undefined,
            cookTime: recipe.cookTime ?? undefined,
            servings: recipe.servings ?? undefined,
            ingredients: recipe.ingredients as string[],
            instructions: recipe.instructions as string[],
            sourceUrl: recipe.sourceUrl,
          }}
        />
      </main>
    </>
  );
}
