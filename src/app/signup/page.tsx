"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    try {
      // Register
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        setError(registerData.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // Auto sign in
      const result = await signIn("credentials", {
        email: form.email.trim(),
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created! Please sign in.");
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-brand-600 inline-flex items-center gap-2">
            <span>🍳</span> RecipeExtractor
          </Link>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">
            1 free extraction — no credit card required
          </p>
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
              <label className="text-sm font-medium text-gray-700" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={loading}
              />
            </div>

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
                autoComplete="new-password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                disabled={loading}
                placeholder="At least 8 characters"
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create free account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>

        <p className="text-center text-xs text-gray-400">
          By signing up, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
