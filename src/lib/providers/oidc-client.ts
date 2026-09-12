import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import type { Role } from "@/lib/enums";
import type { ExternalIdentity } from "@/lib/providers/oidc";

/**
 * OIDC authorization-code flow with PKCE — the protocol half of SSO.
 *
 * This file speaks to the identity provider and nothing else: it discovers the
 * endpoints, builds the authorize URL, redeems the code, and verifies the ID
 * token. Turning verified claims into a local session is the job of `oidc.ts`,
 * which is why that seam stays free of protocol detail.
 *
 * Everything is driven by environment variables, so an operator can point
 * Lumina at Azure AD, Okta, Google Workspace, Keycloak, or Auth0 without a code
 * change.
 */

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  autoProvision: boolean;
  defaultRole: Role;
  buttonLabel: string;
  /** Explicit override; otherwise derived from the incoming request origin. */
  redirectUri: string | null;
}

/**
 * Reads SSO settings, or null when SSO is not configured. Returning null rather
 * than throwing is deliberate: SSO is optional, and an unconfigured instance
 * must keep working as a plain credential-login deployment.
 */
export function oidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();

  if (!issuer || !clientId || !clientSecret) return null;

  const role = process.env.OIDC_DEFAULT_ROLE?.trim().toUpperCase();

  return {
    issuer: issuer.replace(/\/$/, ""),
    clientId,
    clientSecret,
    scopes: process.env.OIDC_SCOPES?.trim() || "openid email profile",
    autoProvision: process.env.OIDC_AUTO_PROVISION === "true",
    defaultRole:
      role === "ADMIN" || role === "INSTRUCTOR" ? (role as Role) : "LEARNER",
    buttonLabel: process.env.OIDC_BUTTON_LABEL?.trim() || "Sign in with SSO",
    redirectUri: process.env.OIDC_REDIRECT_URI?.trim() || null,
  };
}

export function isOidcEnabled(): boolean {
  return oidcConfig() !== null;
}

/** The one path the IdP redirects back to. Registered with the provider. */
export const OIDC_CALLBACK_PATH = "/api/auth/callback/oidc";

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  token_endpoint_auth_methods_supported?: string[];
}

/**
 * Discovery documents are static in practice, but a network hop each time would
 * put the IdP on the critical path of every sign-in, so they are cached for an
 * hour per issuer.
 */
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const discoveryCache = new Map<string, { at: number; doc: Discovery }>();

export async function discover(issuer: string): Promise<Discovery> {
  const cached = discoveryCache.get(issuer);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.doc;

  const url = `${issuer}/.well-known/openid-configuration`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `OIDC discovery failed: ${response.status} from ${url}. Check OIDC_ISSUER.`
    );
  }

  const doc = (await response.json()) as Discovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error(`OIDC discovery at ${url} is missing required endpoints.`);
  }

  discoveryCache.set(issuer, { at: Date.now(), doc });
  return doc;
}

/**
 * `createRemoteJWKSet` keeps its own key cache and handles rotation, but only
 * for as long as the instance lives — so one per issuer, reused.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(jwksUri: string) {
  let set = jwksCache.get(jwksUri);
  if (!set) {
    set = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, set);
  }
  return set;
}

// --- PKCE ------------------------------------------------------------------

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return base64url(new Uint8Array(digest));
}

// --- Flow ------------------------------------------------------------------

export interface AuthorizeParams {
  config: OidcConfig;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export async function buildAuthorizeUrl(
  params: AuthorizeParams
): Promise<string> {
  const doc = await discover(params.config.issuer);
  const url = new URL(doc.authorization_endpoint);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.config.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

/**
 * Redeems the authorization code. PKCE means the code is useless without the
 * verifier, which never left this server.
 */
export async function exchangeCode(opts: {
  config: OidcConfig;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<string> {
  const doc = await discover(opts.config.issuer);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  // The spec requires client_secret_basic, so prefer it, but fall back to
  // client_secret_post for providers that only advertise that one.
  const methods = doc.token_endpoint_auth_methods_supported;
  const useBasic = !methods || methods.includes("client_secret_basic");

  if (useBasic) {
    const credentials = Buffer.from(
      `${encodeURIComponent(opts.config.clientId)}:${encodeURIComponent(
        opts.config.clientSecret
      )}`
    ).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
  } else {
    body.set("client_id", opts.config.clientId);
    body.set("client_secret", opts.config.clientSecret);
  }

  const response = await fetch(doc.token_endpoint, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    // The body usually names the real cause (bad redirect_uri, expired code),
    // and it is the operator who needs to see it — never the browser.
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Token exchange failed: ${response.status} ${detail.slice(0, 500)}`
    );
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) {
    throw new Error("Token response contained no id_token.");
  }
  return payload.id_token;
}

/**
 * Verifies the ID token against the published keys of the issuer, and checks it
 * was minted for this client in response to this sign-in.
 */
export async function verifyIdToken(opts: {
  config: OidcConfig;
  idToken: string;
  nonce: string;
}): Promise<JWTPayload> {
  const doc = await discover(opts.config.issuer);

  const { payload } = await jwtVerify(opts.idToken, jwksFor(doc.jwks_uri), {
    issuer: opts.config.issuer,
    audience: opts.config.clientId,
  });

  // Without this, a token captured from another sign-in could be replayed.
  if (payload.nonce !== opts.nonce) {
    throw new Error("ID token nonce did not match the initiating request.");
  }

  return payload;
}

/**
 * Projects provider claims onto the shape `signInWithExternalIdentity` expects.
 *
 * `email_verified` is rejected only when the provider explicitly says false.
 * Many enterprise IdPs omit it entirely for directory-backed accounts, so
 * requiring it outright would lock out perfectly legitimate deployments — but
 * honouring an explicit false matters, because a provider that lets users set
 * an arbitrary unverified address would otherwise offer a takeover path onto an
 * existing Lumina account with that email.
 */
export function identityFromClaims(claims: JWTPayload): ExternalIdentity | null {
  const email = typeof claims.email === "string" ? claims.email.trim() : "";
  if (!email) return null;
  if (claims.email_verified === false) return null;

  const str = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const composed = [str(claims.given_name), str(claims.family_name)]
    .filter(Boolean)
    .join(" ");

  return {
    email,
    name: str(claims.name) ?? (composed || email.split("@")[0]),
    // Neither of these is a standard OIDC claim, but both are commonly mapped
    // by enterprise directories and cost nothing to pick up when present.
    title: str(claims.title) ?? str(claims.job_title),
    department: str(claims.department),
    avatarUrl: str(claims.picture),
  };
}
