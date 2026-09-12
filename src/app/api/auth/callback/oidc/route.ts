import { NextResponse, type NextRequest } from "next/server";

import { verifyShortLivedToken } from "@/lib/auth";
import {
  exchangeCode,
  identityFromClaims,
  oidcConfig,
  verifyIdToken,
} from "@/lib/providers/oidc-client";
import { signInWithExternalIdentity } from "@/lib/providers/oidc";
import {
  OIDC_TX_COOKIE,
  safeNextPath,
} from "@/lib/providers/oidc-transaction";
import type { SignInFailure } from "@/lib/providers/oidc";

/**
 * The IdP sends the browser back here with an authorization code.
 *
 * Order matters. The transaction cookie is verified and the state compared
 * before the code is redeemed, so a forged callback costs nothing but a cookie
 * read — no token endpoint call, no database query.
 */

const FAILURE_ERRORS: Record<SignInFailure, string> = {
  "no-email": "sso_email",
  "no-account": "sso_no_account",
  "domain-not-allowed": "sso_domain",
  inactive: "sso_inactive",
};

function allowedDomains(): string[] {
  return (process.env.AUTH_ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  const fail = (code: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", code);
    const response = NextResponse.redirect(url);
    // The transaction is single-use whatever the outcome, so it goes on every
    // path out of here rather than only the happy one.
    response.cookies.delete(OIDC_TX_COOKIE);
    return response;
  };

  const config = oidcConfig();
  if (!config) return fail("sso_unconfigured");

  // The provider refused — consent declined, app blocked, account disabled
  // upstream. It tells us in the query string rather than by redirecting.
  if (params.get("error")) {
    console.warn(
      "[lumina] SSO provider returned an error:",
      params.get("error"),
      params.get("error_description") ?? ""
    );
    return fail("sso_denied");
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("sso_state");

  const cookie = request.cookies.get(OIDC_TX_COOKIE)?.value;
  if (!cookie) return fail("sso_state");

  const transaction = await verifyShortLivedToken(cookie);
  if (!transaction) return fail("sso_state");

  const expectedState = transaction.state;
  const nonce = transaction.nonce;
  const codeVerifier = transaction.codeVerifier;
  const redirectUri = transaction.redirectUri;

  if (
    typeof expectedState !== "string" ||
    typeof nonce !== "string" ||
    typeof codeVerifier !== "string" ||
    typeof redirectUri !== "string" ||
    state !== expectedState
  ) {
    return fail("sso_state");
  }

  let result;
  try {
    const idToken = await exchangeCode({
      config,
      code,
      redirectUri,
      codeVerifier,
    });
    const claims = await verifyIdToken({ config, idToken, nonce });
    const identity = identityFromClaims(claims);
    if (!identity) return fail("sso_email");

    result = await signInWithExternalIdentity(identity, {
      autoProvision: config.autoProvision,
      defaultRole: config.defaultRole,
      allowedEmailDomains: allowedDomains(),
    });
  } catch (error) {
    // Signature mismatches, expired codes, unreachable IdPs. The detail belongs
    // in the server log, never in a redirect the browser can read.
    console.error("[lumina] SSO callback failed:", error);
    return fail("sso_failed");
  }

  if (!result.ok) return fail(FAILURE_ERRORS[result.reason]);

  // `signInWithExternalIdentity` has written the session cookie via
  // next/headers; Next merges that into whatever response we return.
  const target = new URL(safeNextPath(transaction.next as string), origin);
  const response = NextResponse.redirect(target);
  response.cookies.delete(OIDC_TX_COOKIE);
  return response;
}
