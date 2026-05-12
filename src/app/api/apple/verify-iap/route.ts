// POST /api/apple/verify-iap
//
// Body: { signedTransaction: string, productId: string }
//   - signedTransaction: the JWS string from StoreKit 2's
//     `VerificationResult.jwsRepresentation`.
//   - productId: a sanity-check that the JWS matches what the iOS app
//     thinks it just purchased.
//
// Response: { tier: "FREE" | "PREMIUM" | "PRO" }
//
// Side effects: updates the user's tier on success.
//
// Currently NOT implemented (deferred to App Store Server Notifications v2):
//   - Tracking subscription auto-renewals / cancellations / refunds.
//     For now, the user's tier is set when they purchase and only changes
//     back to FREE if a refund/revocation is observed via this endpoint
//     (e.g. on app launch when restoring purchases).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/mobile-auth";
import { verifyAppleTransaction } from "@/lib/apple-iap";
import type { Tier } from "@prisma/client";

const schema = z.object({
  signedTransaction: z.string().min(1),
  productId: z.string().min(1),
});

const PRODUCT_TO_TIER: Record<string, Tier> = {
  "com.recipeextractor.premium.monthly": "PREMIUM",
  "com.recipeextractor.pro.monthly": "PRO",
  "com.recipeextractor.pro.yearly": "PRO",
};

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  // 1. Verify JWS and decode.
  let decoded;
  try {
    decoded = await verifyAppleTransaction(parsed.data.signedTransaction);
  } catch (err) {
    console.error("[verify-iap] JWS verification failed:", err);
    return NextResponse.json(
      { error: "Could not verify App Store transaction" },
      { status: 400 }
    );
  }

  // 2. Cross-check the productId the iOS client claimed matches the signed one.
  if (decoded.productId !== parsed.data.productId) {
    console.warn("[verify-iap] productId mismatch", {
      claimed: parsed.data.productId,
      signed: decoded.productId,
    });
    return NextResponse.json(
      { error: "Product ID mismatch with signed transaction" },
      { status: 400 }
    );
  }

  // 3. Revocation = refunded/family-removed. Drop them to FREE.
  if (decoded.revocationDate) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: "FREE" },
    });
    return NextResponse.json({ tier: "FREE" });
  }

  // 4. Expiry check for subscriptions. expiresDate is ms since epoch.
  if (decoded.expiresDate && decoded.expiresDate < Date.now()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: "FREE" },
    });
    return NextResponse.json({ tier: "FREE" });
  }

  // 5. Map product to tier.
  const tier = PRODUCT_TO_TIER[decoded.productId];
  if (!tier) {
    console.error("[verify-iap] Unknown productId:", decoded.productId);
    return NextResponse.json(
      { error: `Unknown product: ${decoded.productId}` },
      { status: 400 }
    );
  }

  // 6. Persist tier + the originalTransactionId so server-to-server
  //    notifications (renewals, refunds, cancellations) can find this user
  //    later. originalTransactionId is stable across all renewals in the
  //    subscription group, so it's the right id to key on.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier,
      ...(decoded.originalTransactionId
        ? { appleOriginalTransactionId: decoded.originalTransactionId }
        : {}),
    },
  });

  return NextResponse.json({ tier });
}
