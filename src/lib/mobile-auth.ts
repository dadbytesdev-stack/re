// Mobile (Bearer-token) auth helper.
//
// The web app authenticates via NextAuth's HttpOnly session cookie. Native
// mobile clients (the iOS app at /Users/dadbytes/Documents/re-ios) cannot
// use cookies the same way, so they instead receive a JWT from
// /api/auth/mobile/signin and send it back as `Authorization: Bearer <jwt>`.
//
// We piggy-back on next-auth's encode/decode so we don't add a new dep and
// the same NEXTAUTH_SECRET protects both transports.

import type { NextRequest } from "next/server";
import { encode, decode } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Tier } from "@prisma/client";

const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface MobileTokenPayload {
  sub: string; // user id
  email: string;
  tier: Tier;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }
  return secret;
}

/** Issue a Bearer JWT for a freshly authenticated mobile user. */
export async function issueMobileToken(payload: MobileTokenPayload): Promise<string> {
  return encode({
    token: { ...payload },
    secret: getSecret(),
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
}

/** Parse a Bearer JWT from the Authorization header, if present and valid. */
async function readBearerUser(req: NextRequest | Request): Promise<MobileTokenPayload | null> {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = await decode({ token, secret: getSecret() });
    if (!decoded || typeof decoded !== "object") return null;
    const sub = (decoded as { sub?: string }).sub;
    const email = (decoded as { email?: string }).email;
    const tier = (decoded as { tier?: Tier }).tier;
    if (!sub || !email || !tier) return null;
    return { sub, email, tier };
  } catch {
    return null;
  }
}

/**
 * The shape every protected route needs: a user with at least `id` and `tier`.
 * Matches what `session.user` provided before this change so existing call
 * sites keep working when we swap them over.
 */
export interface AuthUser {
  id: string;
  email: string;
  tier: Tier;
}

/**
 * Returns the authenticated user from either a NextAuth session cookie (web)
 * or a mobile Bearer JWT, or null if neither is present/valid.
 *
 * For mobile tokens we re-read `tier` from the DB so an old token can't keep
 * a user on a stale plan after they upgrade/downgrade.
 */
export async function getAuthUser(req: NextRequest | Request): Promise<AuthUser | null> {
  // 1. Mobile Bearer token
  const bearer = await readBearerUser(req);
  if (bearer) {
    const fresh = await prisma.user.findUnique({
      where: { id: bearer.sub },
      select: { id: true, email: true, tier: true },
    });
    if (fresh) return fresh;
    return null;
  }

  // 2. Web NextAuth session cookie
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      tier: session.user.tier,
    };
  }

  return null;
}
