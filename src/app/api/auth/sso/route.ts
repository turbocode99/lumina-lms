import { NextResponse, type NextRequest } from "next/server";

import { isSecureRequest, signShortLivedToken } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  codeChallengeFor,
  oidcConfig,
  randomToken,
} from "@/lib/providers/oidc-client";
import {
  OIDC_TX_COOKIE,
  OIDC_TX_TTL_SECONDS,
  resolveRedirectUri,
  safeNextPath,
} from "@/lib/providers/oidc-transaction";

/**
 * Starts the SSO round trip.
 *
 * The state, nonce, and PKCE verifier are minted here and parked in one signed,
 * httpOnly cookie while the browser is away at the IdP. Signing them matters:
 * httpOnly stops script access, but anything able to write a cookie for this
 * host — a sibling subdomain, or a network position on a plain-HTTP deployment —
 * could otherwise fixate the state and complete a login CSRF.
 */
export async function GET(request: NextRequest) {
  const config = oidcConfig();
  const loginUrl = new URL("/login", request.nextUrl.origin);

  if (!config) {
    loginUrl.searchParams.set("error", "sso_unconfigured");
    return NextResponse.redirect(loginUrl);
  }

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();
  const redirectUri = resolveRedirectUri(request, config);

  let authorizeUrl: string;
  try {
    authorizeUrl = await buildAuthorizeUrl({
      config,
      redirectUri,
      state,
      nonce,
      codeChallenge: await codeChallengeFor(codeVerifier),
    });
  } catch (error) {
    // Almost always a bad OIDC_ISSUER or an unreachable IdP. The operator needs
    // the detail; the visitor gets a generic failure.
    console.error("[lumina] SSO start failed:", error);
    loginUrl.searchParams.set("error", "sso_failed");
    return NextResponse.redirect(loginUrl);
  }

  const transaction = await signShortLivedToken(
    { state, nonce, codeVerifier, next, redirectUri },
    OIDC_TX_TTL_SECONDS
  );

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OIDC_TX_COOKIE, transaction, {
    httpOnly: true,
    secure: await isSecureRequest(),
    // `lax` is required, not merely preferred: the IdP sends the browser back
    // with a top-level GET, which `strict` would strip the cookie from, and the
    // callback would then have nothing to verify against.
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_TX_TTL_SECONDS,
  });

  return response;
}
