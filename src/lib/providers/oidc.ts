import "server-only";

import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import type { Role } from "@/lib/enums";

/**
 * SSO provider stub — Azure AD / Okta / Google Workspace.
 *
 * The credential flow in `src/app/(auth)/login` and the session helpers in
 * `src/lib/auth.ts` are deliberately decoupled: anything that can resolve an
 * external identity to a local User row can call `createSession()` and the rest
 * of the app works unchanged.
 *
 * To wire up a real IdP:
 *
 *  1. Register the app with your provider and set the redirect URI to
 *     `https://<your-host>/api/auth/callback/oidc`.
 *  2. Add OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET to .env.
 *  3. Add a route handler at `src/app/api/auth/callback/oidc/route.ts` that
 *     exchanges the authorization code for an ID token, verifies it against the
 *     issuer's JWKS (the `jose` package is already a dependency —
 *     `createRemoteJWKSet` + `jwtVerify`), then calls the function below with
 *     the verified claims.
 *  4. Add a "Sign in with SSO" button to the login page pointing at the
 *     provider's authorize endpoint.
 *
 * Nothing else in the codebase needs to change.
 */

export interface ExternalIdentity {
  email: string;
  name: string;
  title?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
}

export interface ProvisionOptions {
  /**
   * Create a local account on first sign-in. Leave false to require that an
   * admin pre-provisions users, which is the stricter posture.
   */
  autoProvision?: boolean;
  /** Role granted to auto-provisioned accounts. */
  defaultRole?: Role;
}

/**
 * Maps a verified external identity onto a local user and opens a session.
 * Returns null when the account does not exist and auto-provisioning is off.
 */
export async function signInWithExternalIdentity(
  identity: ExternalIdentity,
  options: ProvisionOptions = {}
): Promise<{ id: string; role: Role } | null> {
  const email = identity.email.trim().toLowerCase();
  if (!email) return null;

  let user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true },
  });

  if (!user) {
    if (!options.autoProvision) return null;
    const created = await db.user.create({
      data: {
        email,
        name: identity.name || email.split("@")[0],
        // SSO accounts never sign in with a password; store an unusable hash so
        // the column stays non-null and credential login can't succeed.
        passwordHash: await hashPassword(crypto.randomUUID()),
        role: options.defaultRole ?? "LEARNER",
        title: identity.title ?? null,
        department: identity.department ?? null,
        avatarUrl: identity.avatarUrl ?? null,
      },
      select: { id: true, role: true, isActive: true },
    });
    user = created;
  }

  if (!user.isActive) return null;

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id, user.role as Role);
  return { id: user.id, role: user.role as Role };
}
