import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
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

/**
 * Placeholder values that ship in the templates. They are long enough to pass a
 * naive length check, so they are rejected by name — otherwise a public, shared
 * string could silently become a real production signing key.
 */
const PLACEHOLDER_SECRETS = new Set([
  "replace-me-with-a-long-random-string-at-least-32-chars",
  "build-time-placeholder-not-used-at-runtime",
  "changeme",
  "secret",
]);

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Run `npm run setup` to generate one, " +
        "or set it yourself with `openssl rand -base64 32`."
    );
  }

  // The dev default is tolerated locally so `npm run dev` works out of the box,
  // but never in production.
  if (
    PLACEHOLDER_SECRETS.has(secret) ||
    (process.env.NODE_ENV === "production" && secret.startsWith("dev-only-secret"))
  ) {
    throw new Error(
      "AUTH_SECRET is still a placeholder value. Every session in this deployment " +
        "would be forgeable by anyone who has read the source. Generate a real one " +
        "with `openssl rand -base64 32` and set it in your environment."
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

/**
 * Whether the browser reached us over TLS.
 *
 * This decides the cookie's `Secure` flag, and getting it wrong is unusually
 * painful. Setting `Secure` purely because NODE_ENV is "production" means that on
 * a production build served over plain HTTP — a LAN address, an internal host
 * without TLS, a colleague testing from their phone — the browser silently
 * *discards* the cookie. Sign-in appears to succeed, then bounces straight back to
 * the login form with no error anywhere. Localhost is exempt in browsers, which is
 * exactly why it never shows up in local testing.
 *
 * So the flag follows the actual connection: set whenever the request arrived over
 * HTTPS (directly, or via a proxy that says so), and omitted otherwise. `httpOnly`
 * and `sameSite` are unconditional either way.
 */
async function isSecureRequest(): Promise<boolean> {
  const list = await headers();

  // Set by essentially every reverse proxy; may be a comma-separated chain.
  const forwardedProto = list.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  }

  // Some proxies use these instead.
  if (list.get("x-forwarded-ssl") === "on") return true;
  if (list.get("front-end-https") === "on") return true;

  // Direct TLS termination in Node: Next surfaces the origin protocol here.
  const origin = list.get("origin") ?? list.get("referer");
  if (origin?.startsWith("https://")) return true;

  return false;
}

let warnedAboutInsecureCookie = false;

/** Writes the session cookie. Call after a successful credential check. */
export async function createSession(userId: string, role: Role): Promise<void> {
  const token = await signSessionToken({ sub: userId, role });
  const secure = await isSecureRequest();

  if (!secure && process.env.NODE_ENV === "production" && !warnedAboutInsecureCookie) {
    warnedAboutInsecureCookie = true;
    console.warn(
      "[lumina] Serving over plain HTTP: the session cookie is being set without " +
        "the Secure flag so sign-in works. Put TLS in front of this before it is " +
        "reachable by anyone you do not trust — session cookies are readable on the wire."
    );
  }

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
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
