import type { Tier } from "@prisma/client";

/**
 * App Store product ids and the tier each one grants.
 *
 * Shared by /api/apple/verify-iap and /api/apple/notifications so the two
 * can't drift apart — they did once, which is how the Lifetime product went
 * missing from both.
 */

/** Non-consumable: bought once, never expires. */
export const APPLE_LIFETIME_PRODUCT_ID = "com.recipeextractor.pro.lifetime";

export const APPLE_PRODUCT_TO_TIER: Record<string, Tier> = {
  "com.recipeextractor.premium.monthly": "PREMIUM",
  "com.recipeextractor.pro.monthly": "PRO",
  "com.recipeextractor.pro.yearly": "PRO",
  [APPLE_LIFETIME_PRODUCT_ID]: "LIFETIME",
};

/**
 * Lifetime is permanent, whichever store it was bought from (Stripe on web
 * and Android, or the App Store). Anything that happens to a *subscription*
 * — it expiring, being refunded, or being re-verified on restore — must
 * never move a Lifetime user off LIFETIME. Only an event on the Apple
 * Lifetime product itself (e.g. a refund of it) may.
 */
export function protectsLifetime(currentTier: Tier, productId: string): boolean {
  return currentTier === "LIFETIME" && productId !== APPLE_LIFETIME_PRODUCT_ID;
}
