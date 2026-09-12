import "server-only";

import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import type { Role } from "@/lib/enums";

/**
 * SSO account mapping — Azure AD / Okta / Google Workspace / Keycloak / Auth0.
 *
 * The credential flow in `src/app/(auth)/login` and the session helpers in
 * `src/lib/auth.ts` are deliberately decoupled: anything that can resolve an
 * external identity to a local User row can call `createSession()` and the rest
 * of the app works unchanged. This file is that resolver, and it is the only
 * place where provisioning policy lives.
 *
 * The protocol half — discovery, authorize URL, code exchange, ID token
 * verification — is in `oidc-client.ts`, driven by the two route handlers under
 * `src/app/api/auth/`. Nothing here knows what OIDC is, on purpose: swapping in
 * SAML or a header-based proxy means writing a new caller, not editing this.
 *
 * To point an instance at a provider:
 *
 *  1. Register the app with your IdP, redirect URI
 *     `https://<your-host>/api/auth/callback/oidc`.
 *  2. Set OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET in `.env`.
 *
 * The login page grows a "Sign in with SSO" button as soon as those three are
 * present, and drops it again if they are removed.
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
  /**
   * Restricts which email domains may be auto-provisioned. Existing accounts are
   * unaffected: an admin who deliberately created a contractor on some other
   * domain should not be locked out by a rule meant to govern self-service.
   */
  allowedEmailDomains?: string[];
}

export type SignInFailure =
  | "no-email"
  | "no-account"
  | "domain-not-allowed"
  | "inactive";

export type SignInResult =
  | { ok: true; user: { id: string; role: Role } }
  | { ok: false; reason: SignInFailure };

/**
 * Maps a verified external identity onto a local user and opens a session.
 *
 * Failures are returned as reason codes rather than a bare null so the caller
 * can tell an operator what actually went wrong — "no account and
 * auto-provisioning is off" and "account deactivated" need very different
 * responses, and guessing between them wastes support time.
 */
export async function signInWithExternalIdentity(
  identity: ExternalIdentity,
  options: ProvisionOptions = {}
): Promise<SignInResult> {
  const email = identity.email.trim().toLowerCase();
  if (!email) return { ok: false, reason: "no-email" };

  let user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, isActive: true },
  });

  if (!user) {
    if (!options.autoProvision) return { ok: false, reason: "no-account" };

    const domains = options.allowedEmailDomains ?? [];
    if (domains.length && !domains.includes(email.split("@")[1] ?? "")) {
      return { ok: false, reason: "domain-not-allowed" };
    }

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

  if (!user.isActive) return { ok: false, reason: "inactive" };

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id, user.role as Role);
  return { ok: true, user: { id: user.id, role: user.role as Role } };
}
