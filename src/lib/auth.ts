import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";
import type { Role } from "@/lib/enums";

/**
 * Session strategy
 * ----------------
 * A signed, httpOnly JWT in a cookie. No session table, no external auth
 * service, no extra container to deploy — which is what keeps the footprint
 * small. The token carries only the user id and a role snapshot; every server
 * render re-reads the user row, so a role change or deactivation takes effect on
 * the next request rather than waiting for the token to expire.
 *
 * Adding SSO: implement a provider in `src/lib/providers/` that resolves an
 * external identity to a local User row, then call `createSession(user.id)`.
 * See `src/lib/providers/oidc.ts` for a worked stub.
 */

const COOKIE_NAME = "lumina_session";
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sessionMaxAge(): number {
  const parsed = Number(process.env.AUTH_SESSION_MAX_AGE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with `openssl rand -base64 32` and set it in .env"
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const maxAge = sessionMaxAge();
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: (payload.role as Role) ?? "LEARNER" };
  } catch {
    return null;
  }
}

/** Writes the session cookie. Call after a successful credential check. */
export async function createSession(userId: string, role: Role): Promise<void> {
  const token = await signSessionToken({ sub: userId, role });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  title: string | null;
  department: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
};

/**
 * Resolves the signed-in user, or null. Wrapped in `cache()` so a page that
 * calls it from the layout, the nav, and three components still issues one
 * query per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      title: true,
      department: true,
      avatarUrl: true,
      headline: true,
      bio: true,
      isActive: true,
    },
  });

  // A deactivated account keeps its cookie but loses access immediately.
  if (!user || !user.isActive) return null;

  const { isActive: _isActive, ...rest } = user;
  return { ...rest, role: rest.role as Role };
});

export const SESSION_COOKIE_NAME = COOKIE_NAME;
