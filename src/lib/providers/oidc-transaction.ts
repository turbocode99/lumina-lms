import "server-only";

import type { NextRequest } from "next/server";

import { OIDC_CALLBACK_PATH, type OidcConfig } from "@/lib/providers/oidc-client";

/**
 * The small amount of state shared by the two halves of the SSO round trip.
 * Kept in its own file so neither route handler has to import the other.
 */

export const OIDC_TX_COOKIE = "lumina_oidc_tx";

/**
 * Ten minutes is generous for a sign-in the user is actively performing, and
 * short enough that an abandoned transaction cannot be resumed later.
 */
export const OIDC_TX_TTL_SECONDS = 600;

/**
 * Only same-origin relative paths survive. An absolute URL here would turn the
 * SSO entry point into an open redirect, which is the same trap the credential
 * login guards against in `loginAction`.
 */
export function safeNextPath(value: string | null | undefined): string {
  const next = (value ?? "").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

/**
 * The redirect URI must match what is registered with the IdP byte for byte, so
 * an explicit OIDC_REDIRECT_URI always wins.
 *
 * Deriving it is the fallback, and it honours the forwarding headers rather than
 * trusting the socket: behind a TLS-terminating proxy the request arrives as
 * plain HTTP on an internal hostname, so the naive origin would be an http://
 * URL the provider has never heard of, and the exchange would fail with a
 * redirect_uri mismatch that is genuinely unpleasant to diagnose.
 */
export function resolveRedirectUri(
  request: NextRequest,
  config: OidcConfig
): string {
  if (config.redirectUri) return config.redirectUri;

  const headers = request.headers;
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  const protocol =
    forwardedProto ||
    (headers.get("x-forwarded-ssl") === "on" ? "https" : null) ||
    request.nextUrl.protocol.replace(":", "");
  const host = forwardedHost || headers.get("host") || request.nextUrl.host;

  return `${protocol}://${host}${OIDC_CALLBACK_PATH}`;
}

/** Messages for every way the round trip can fail, keyed by `?error=`. */
export const SSO_ERROR_MESSAGES: Record<string, string> = {
  sso_unconfigured:
    "Single sign-on is not configured on this instance. Sign in with your email and password.",
  sso_denied: "Your identity provider declined the sign-in request.",
  sso_state:
    "That sign-in link has expired or was already used. Please try again.",
  sso_email:
    "Your identity provider did not return a verified email address, so there is no account to match.",
  sso_no_account:
    "There is no Lumina account for that address. Ask an administrator to create one.",
  sso_domain:
    "Accounts cannot be created automatically for that email domain. Ask an administrator.",
  sso_inactive:
    "That account has been deactivated. Contact your administrator.",
  sso_failed: "Single sign-on failed. Please try again or contact your administrator.",
};
