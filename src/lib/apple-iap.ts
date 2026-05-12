// Apple In-App Purchase verification.
//
// The iOS app sends StoreKit 2's `jwsRepresentation` (a JWS-signed transaction
// payload) along with the productId. We:
//   1. Cryptographically verify the JWS against Apple's root CA certs so a
//      malicious client cannot forge a transaction.
//   2. Decode the payload (productId, expiresDate, revocationDate, env, etc.).
//
// Setup notes:
//   - Set APPLE_BUNDLE_ID = "com.recipeextractor.app" (must match the
//     bundle ID in your iOS Info.plist and App Store Connect).
//   - Download the two Apple root certs once from
//     https://www.apple.com/certificateauthority/ and set them as
//     base64-encoded env vars:
//        APPLE_ROOT_CA_G3_BASE64=$(base64 -i AppleRootCA-G3.cer)
//        APPLE_ROOT_CA_G2_BASE64=$(base64 -i AppleRootCA-G2.cer)
//   - For local Xcode/Simulator testing against a `.storekit`
//     configuration file, set STOREKIT_DEV_BYPASS=1. This skips the
//     cryptographic check (because the simulator signs with a local test
//     CA, not Apple's real roots) but still decodes the payload and
//     validates productId/bundleId. NEVER set this in production.

import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";
import type {
  JWSTransactionDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

export interface DecodedAppleTransaction {
  productId: string;
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  expiresDate?: number; // ms since epoch
  revocationDate?: number;
  environment?: string;
  raw: JWSTransactionDecodedPayload;
}

function loadRootCerts(): Buffer[] {
  const certs: Buffer[] = [];
  const g3 = process.env.APPLE_ROOT_CA_G3_BASE64;
  const g2 = process.env.APPLE_ROOT_CA_G2_BASE64;
  if (g3) certs.push(Buffer.from(g3, "base64"));
  if (g2) certs.push(Buffer.from(g2, "base64"));
  return certs;
}

/**
 * Detect Apple environment from the JWS payload (`environment` claim) so we
 * can pick the right verifier setup. The claim is in the unverified payload —
 * that's fine because we cross-check it against the verified result.
 */
function peekEnvironment(jws: string): Environment {
  try {
    const [, payload] = jws.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    const env = decoded.environment as string | undefined;
    if (env === "Production") return Environment.PRODUCTION;
    if (env === "Sandbox") return Environment.SANDBOX;
    if (env === "Xcode") return Environment.XCODE;
    if (env === "LocalTesting") return Environment.LOCAL_TESTING;
  } catch {
    // fall through
  }
  return Environment.SANDBOX;
}

/** Base64-decode a JWS payload without verification. Used only for dev bypass. */
function unsafeDecode(jws: string): JWSTransactionDecodedPayload {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWS");
  return JSON.parse(
    Buffer.from(parts[1], "base64").toString("utf8")
  ) as JWSTransactionDecodedPayload;
}

export async function verifyAppleTransaction(
  signedTransaction: string
): Promise<DecodedAppleTransaction> {
  const bundleId = process.env.APPLE_BUNDLE_ID;
  if (!bundleId) {
    throw new Error("APPLE_BUNDLE_ID env var is not set");
  }

  let payload: JWSTransactionDecodedPayload;

  if (process.env.STOREKIT_DEV_BYPASS === "1") {
    // ⚠️ Simulator / .storekit configuration testing only.
    payload = unsafeDecode(signedTransaction);
  } else {
    const roots = loadRootCerts();
    if (roots.length === 0) {
      throw new Error(
        "Apple root certs missing. Set APPLE_ROOT_CA_G3_BASE64 (and optionally APPLE_ROOT_CA_G2_BASE64), or set STOREKIT_DEV_BYPASS=1 for simulator testing."
      );
    }

    const environment = peekEnvironment(signedTransaction);
    // enableOnlineChecks=false avoids per-request OCSP traffic; the cert chain
    // is still verified offline against the embedded root certs.
    const verifier = new SignedDataVerifier(
      roots,
      false,
      environment,
      bundleId
    );

    payload = await verifier.verifyAndDecodeTransaction(signedTransaction);
  }

  if (!payload.productId) {
    throw new Error("Decoded transaction is missing productId");
  }
  if (payload.bundleId && payload.bundleId !== bundleId) {
    throw new Error(
      `bundleId mismatch: token=${payload.bundleId} expected=${bundleId}`
    );
  }

  return {
    productId: payload.productId,
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId,
    bundleId: payload.bundleId,
    expiresDate: payload.expiresDate,
    revocationDate: payload.revocationDate,
    environment: payload.environment,
    raw: payload,
  };
}

/**
 * Verify and decode an App Store Server Notification V2 payload. Apple sends
 * these to the URL registered in App Store Connect for events like
 * renewals, refunds, cancellations, etc.
 *
 * Returns BOTH the outer notification (for type/subtype) and the decoded
 * inner transaction (for productId/expiresDate/originalTransactionId).
 */
export async function verifyAppleNotification(
  signedPayload: string
): Promise<{
  notification: ResponseBodyV2DecodedPayload;
  transaction: DecodedAppleTransaction | null;
}> {
  const bundleId = process.env.APPLE_BUNDLE_ID;
  if (!bundleId) throw new Error("APPLE_BUNDLE_ID env var is not set");

  let notification: ResponseBodyV2DecodedPayload;

  if (process.env.STOREKIT_DEV_BYPASS === "1") {
    // Same caveat as verifyAppleTransaction: never use in production.
    const parts = signedPayload.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWS notification");
    notification = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    ) as ResponseBodyV2DecodedPayload;
  } else {
    const roots = loadRootCerts();
    if (roots.length === 0) {
      throw new Error(
        "Apple root certs missing. Set APPLE_ROOT_CA_G3_BASE64 (and APPLE_ROOT_CA_G2_BASE64)."
      );
    }
    // We peek the outer payload to choose the right environment. Notifications
    // include an environment field in `data` or `summary`.
    let env: Environment = Environment.PRODUCTION;
    try {
      const [, payload] = signedPayload.split(".");
      const peeked = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
      const envStr =
        peeked?.data?.environment ?? peeked?.summary?.environment;
      if (envStr === "Sandbox") env = Environment.SANDBOX;
      else if (envStr === "Xcode") env = Environment.XCODE;
      else if (envStr === "LocalTesting") env = Environment.LOCAL_TESTING;
    } catch {
      // fall back to PRODUCTION
    }

    const verifier = new SignedDataVerifier(roots, false, env, bundleId);
    notification = await verifier.verifyAndDecodeNotification(signedPayload);
  }

  // Decode the inner transaction if present (most notification types include it).
  let transaction: DecodedAppleTransaction | null = null;
  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  if (signedTransactionInfo) {
    try {
      transaction = await verifyAppleTransaction(signedTransactionInfo);
    } catch (err) {
      console.error("[apple-iap] inner transaction verify failed:", err);
    }
  }

  return { notification, transaction };
}
