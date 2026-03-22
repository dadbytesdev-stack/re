"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export function Header() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-brand-600">
          <span className="text-2xl">🍳</span>
          <span>RecipeExtractor</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6">
          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Pricing
          </Link>

          {status === "authenticated" && session.user ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/recipes" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                My Recipes
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold uppercase">
                    {session.user.name?.[0] ?? session.user.email?.[0] ?? "U"}
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
                      {session.user.email}
                    </div>
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/recipes"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      My Recipes
                    </Link>
                    <Link
                      href="/pricing"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Billing
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get started free
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-gray-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-2">
          <Link href="/pricing" className="block py-2 text-sm font-medium text-gray-700" onClick={() => setMenuOpen(false)}>
            Pricing
          </Link>
          {status === "authenticated" ? (
            <>
              <Link href="/dashboard" className="block py-2 text-sm font-medium text-gray-700" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link href="/recipes" className="block py-2 text-sm font-medium text-gray-700" onClick={() => setMenuOpen(false)}>
                My Recipes
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="block w-full text-left py-2 text-sm text-red-600">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="block py-2 text-sm font-medium text-gray-700" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link href="/signup" className="block py-2 text-sm font-medium text-brand-600" onClick={() => setMenuOpen(false)}>
                Get started free
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
