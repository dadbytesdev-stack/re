/**
 * Absolute base URL to use when building redirect URLs for external services
 * (currently Stripe Checkout and the Stripe billing portal).
 *
 * Stripe sends the customer's browser to these URLs, so they have to be
 * absolute and reachable from the public internet. Reading them from
 * `NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` meant that whenever the env
 * var was unset in a deployed environment every payer was redirected to
 * localhost — their own machine — and landed on a dead page.
 *
 * Deriving the origin from the request that is actually being served is
 * correct in every environment (local dev, Vercel preview, production, and a
 * future custom domain) and needs no configuration. The env vars remain as
 * fallbacks for contexts where no request is available.
 */

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i;

export function getAppUrl(req?: Request): string {
  const host =
    req?.headers.get("x-forwarded-host") ?? req?.headers.get("host") ?? null;

  const proto =
    req?.headers.get("x-forwarded-proto") ??
    (host && LOCAL_HOST.test(host) ? "http" : "https");

  const fromRequest = host
    ? `${proto}://${host}`
    : (req?.headers.get("origin") ?? null);

  const url =
    fromRequest ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  // Trailing slashes would produce `//dashboard` in the redirect path.
  return url.replace(/\/+$/, "");
}
