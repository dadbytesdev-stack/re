"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: form.email.trim(),
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password. Please try again.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-brand-600 inline-flex items-center gap-2">
            <span>🍳</span> RecipeExtractor
          </Link>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand-600 font-semibold hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
