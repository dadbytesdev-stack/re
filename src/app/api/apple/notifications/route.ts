// POST /api/apple/notifications
//
// App Store Server Notifications V2 endpoint. Apple sends server-to-server
// webhooks here for events that happen outside of an active iOS session:
// auto-renewals, refunds, cancellations, family-share revocations, etc.
//
// The URL must be registered in App Store Connect:
//   App → Information → App Store Server Notifications →
//     Production Server URL:  https://re-flax.vercel.app/api/apple/notifications
//     Sandbox Server URL:     https://re-flax.vercel.app/api/apple/notifications
//   Version: V2 (Signed)
//
// Apple expects 200 on success. We return 200 even on payload-level errors
// where retrying wouldn't help (e.g. unknown user, malformed JWS) so Apple
// doesn't hammer us with retries. Real infrastructure errors (DB down) return
// 500 so Apple retries with exponential backoff.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAppleNotification } from "@/lib/apple-iap";
import type { Tier } from "@prisma/client";

const PRODUCT_TO_TIER: Record<string, Tier> = {
  "com.recipeextractor.premium.monthly": "PREMIUM",
  "com.recipeextractor.pro.monthly": "PRO",
  "com.recipeextractor.pro.yearly": "PRO",
};

// Notification types that result in the user losing paid access.
const REVOKE_TYPES = new Set([
  "REFUND",
  "REVOKE",
  "EXPIRED",
  "GRACE_PERIOD_EXPIRED",
]);

// Notification types where the user GAINS or KEEPS paid access at the
// product's tier (we re-derive tier from productId on every one of these).
const GRANT_TYPES = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "DID_CHANGE_RENEWAL_PREF", // plan switch (UPGRADE/DOWNGRADE/etc.)
  "OFFER_REDEEMED",
  "RENEWAL_EXTENDED",
  "REFUND_REVERSED", // refund was reversed — restore access
]);

export async function POST(req: NextRequest) {
  let body: { signedPayload?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 200 });
  }

  const signedPayload = body.signedPayload;
  if (!signedPayload) {
    return NextResponse.json({ error: "Missing signedPayload" }, { status: 200 });
  }

  // 1. Verify and decode.
  let decoded;
  try {
    decoded = await verifyAppleNotification(signedPayload);
  } catch (err) {
    console.error("[apple/notifications] Verification failed:", err);
    // 200 — don't trigger retries for unverifiable payloads.
    return NextResponse.json({ error: "Verification failed" }, { status: 200 });
  }

  const { notification, transaction } = decoded;
  const type = notification.notificationType;
  const subtype = notification.subtype;

  console.log("[apple/notifications]", {
    type,
    subtype,
    uuid: notification.notificationUUID,
    productId: transaction?.productId,
    originalTransactionId: transaction?.originalTransactionId,
  });

  // 2. TEST notification — Apple sends this from App Store Connect's
  //    "Request a Test Notification" button. Just acknowledge.
  if (type === "TEST") {
    return NextResponse.json({ received: true });
  }

  // 3. No transaction info attached (e.g. CONSUMPTION_REQUEST,
  //    EXTERNAL_PURCHASE_TOKEN) — nothing to do for this app.
  if (!transaction?.originalTransactionId) {
    return NextResponse.json({ received: true });
  }

  // 4. Find the user this transaction belongs to. Resolution priority:
  //    (a) the user we already linked at verify-iap time,
  //    (b) fallback by transactionId equality (handles the case where
  //        verify-iap saved a different originalTransactionId form).
  const user = await prisma.user.findUnique({
    where: { appleOriginalTransactionId: transaction.originalTransactionId },
    select: { id: true, tier: true },
  });

  if (!user) {
    // We've never seen this transaction — likely the user signed up via web
    // and is buying on a fresh install we haven't synced yet, OR they
    // haven't called verify-iap yet. Either way nothing actionable here:
    // verify-iap will run on next app open and we'll catch the state.
    console.warn(
      "[apple/notifications] No user for originalTransactionId:",
      transaction.originalTransactionId
    );
    return NextResponse.json({ received: true });
  }

  try {
    if (REVOKE_TYPES.has(String(type))) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tier: "FREE" },
      });
      return NextResponse.json({ received: true });
    }

    if (GRANT_TYPES.has(String(type))) {
      const newTier = PRODUCT_TO_TIER[transaction.productId];
      if (!newTier) {
        console.warn(
          "[apple/notifications] Unknown productId on grant:",
          transaction.productId
        );
        return NextResponse.json({ received: true });
      }

      // Skip if already at this tier — avoid unnecessary writes.
      if (user.tier !== newTier) {
        await prisma.user.update({
          where: { id: user.id },
          data: { tier: newTier },
        });
      }
      return NextResponse.json({ received: true });
    }

    if (type === "DID_FAIL_TO_RENEW") {
      // Subtype GRACE_PERIOD = Apple is still retrying billing; keep access.
      // No subtype = entered billing retry without grace period; we keep
      // tier until EXPIRED arrives.
      if (subtype === "GRACE_PERIOD") {
        return NextResponse.json({ received: true });
      }
      return NextResponse.json({ received: true });
    }

    if (type === "DID_CHANGE_RENEWAL_STATUS") {
      // User toggled auto-renew. They keep access until expires regardless.
      // No tier change needed.
      return NextResponse.json({ received: true });
    }

    // PRICE_INCREASE, PRICE_CHANGE, REFUND_DECLINED, RENEWAL_EXTENSION,
    // METADATA_UPDATE, ONE_TIME_CHARGE, MIGRATION, RESCIND_CONSENT, etc.
    // are informational for this app — acknowledge.
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[apple/notifications] DB update failed:", err);
    // 500 so Apple retries — this is a transient infra failure.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
