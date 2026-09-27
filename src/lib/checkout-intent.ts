/**
 * Carrying a purchase intent across the signup wall.
 *
 * A signed-out click on an upgrade button used to push a bare `/signup`, which
 * dropped both the destination and the plan the person had chosen: after
 * registering they landed on `/dashboard` and had to find `/pricing` and press
 * the same button again. These helpers let `/pricing` encode the intent into
 * the signup URL and let `/signup` (or `/login`) hand it back.
 *
 * Client-safe on purpose: it does not import `lib/stripe`, so the Stripe SDK is
 * not pulled into the signup bundle. It reads the same `NEXT_PUBLIC_*` price
 * ids the pricing buttons render.
 */

const PRICE_ID_PATTERN = /^price_[A-Za-z0-9_]+$/;

/**
 * The price ids the browser is allowed to name. Empty when only the
 * server-side price id vars are configured — in that case the shape check
 * below is the only client-side gate, and Stripe rejects anything that is not
 * a real price on this account.
 */
const CLIENT_PRICE_IDS: readonly string[] = [
  process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID,
].filter((id): id is string => Boolean(id));

export function isKnownPriceId(
  priceId: string | null | undefined
): priceId is string {
  if (!priceId || !PRICE_ID_PATTERN.test(priceId)) return false;
  return CLIENT_PRICE_IDS.length === 0 || CLIENT_PRICE_IDS.includes(priceId);
}

/**
 * Only same-origin paths may be used as a post-auth destination, so a crafted
 * `?callbackUrl=https://evil.example` cannot turn signup into an open
 * redirect.
 */
export function safeInternalPath(
  path: string | null | undefined
): string | null {
  if (!path || !path.startsWith("/")) return null;
  // `//host` and `/\host` are both read as protocol-relative by browsers.
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  return path;
}

/** `/pricing` -> the signup URL that remembers where the person was heading. */
export function signupUrlForPrice(
  priceId: string,
  callbackPath = "/pricing"
): string {
  const params = new URLSearchParams({ callbackUrl: callbackPath });
  if (isKnownPriceId(priceId)) params.set("priceId", priceId);
  return `/signup?${params.toString()}`;
}

/** Narrow read-only view of the search params both pages hand in. */
type ReadableParams = { get(name: string): string | null };

/** `/signup` or `/login` -> where to send the person once the account exists. */
export function postAuthDestination(params: ReadableParams): string {
  const callbackUrl = safeInternalPath(params.get("callbackUrl"));
  if (!callbackUrl) return "/dashboard";

  const priceId = params.get("priceId");
  if (!isKnownPriceId(priceId)) return callbackUrl;

  const separator = callbackUrl.includes("?") ? "&" : "?";
  return `${callbackUrl}${separator}priceId=${encodeURIComponent(priceId)}`;
}
