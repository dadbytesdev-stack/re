import { Header } from "@/components/Header";
import { RecipeExtractor } from "@/components/RecipeExtractor";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-b from-white to-gray-50 pt-16 pb-20 px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-brand-200">
              ✨ No ads. No stories. Just the recipe.
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Extract clean recipes<br className="hidden sm:block" /> from any URL
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              Paste a recipe link and get ingredients + step-by-step instructions — stripped of all the blog filler, ads, and life stories.
            </p>

            {/* Extractor */}
            <div className="mt-8 max-w-2xl mx-auto">
              <RecipeExtractor />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  icon: "🔗",
                  title: "Paste a URL",
                  desc: "Copy the link from any recipe website — AllRecipes, Food Network, NYT Cooking, and more.",
                },
                {
                  step: "2",
                  icon: "🤖",
                  title: "AI Extraction",
                  desc: "Our parser strips away the noise and isolates exactly what you need: ingredients and instructions.",
                },
                {
                  step: "3",
                  icon: "📋",
                  title: "Clean result",
                  desc: "Get a structured, readable recipe you can follow without scrolling past ads or blog posts.",
                },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} className="text-center space-y-3">
                  <div className="text-4xl">{icon}</div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-brand-500">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">
              Save your recipes. Access them anywhere.
            </h2>
            <p className="text-brand-100 text-sm">
              Sign up free and save your first recipe. Upgrade for unlimited extractions and full history.
            </p>
            <Link href="/signup" className="inline-flex items-center justify-center px-6 py-3 bg-white text-brand-600 font-semibold rounded-xl hover:bg-brand-50 transition-colors">
              Get started — it&apos;s free
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} RecipeExtractor. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/login" className="hover:text-gray-600">Sign in</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
