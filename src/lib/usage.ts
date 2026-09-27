import { Tier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Extractions allowed per month, per tier. Quoted to users in lib/stripe.ts. */
export const TIER_LIMITS: Record<Tier, number> = {
  FREE: 10,
  PREMIUM: 20,
  PRO: Infinity,
  LIFETIME: Infinity,
};

/** Extractions a signed-out visitor gets before we ask them to sign in. */
export const GUEST_LIMIT = 1;

/**
 * Returns true if the user can make another extraction.
 * Also resets monthly counter if a new month has started.
 */
export async function canExtract(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  tier: Tier;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true, extractionsUsed: true, usageResetAt: true },
  });

  if (!user) throw new Error("User not found");

  // Reset counter if it's a new month
  const now = new Date();
  const resetAt = new Date(user.usageResetAt);
  const needsReset =
    now.getFullYear() > resetAt.getFullYear() ||
    now.getMonth() > resetAt.getMonth();

  let { extractionsUsed } = user;

  if (needsReset) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        extractionsUsed: 0,
        usageResetAt: now,
      },
    });
    extractionsUsed = 0;
  }

  const limit = TIER_LIMITS[user.tier];
  const allowed = extractionsUsed < limit;

  return { allowed, used: extractionsUsed, limit, tier: user.tier };
}

/** Increments the extraction counter for a user. */
export async function incrementUsage(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { extractionsUsed: { increment: 1 } },
  });
}
