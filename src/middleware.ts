import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-side gate. This only checks that a session cookie is *present* — it does
 * not verify the signature, because the real authorization decision happens in
 * `requireUser`/`requireRole` on every page and action where the database is
 * reachable. The point here is to avoid rendering an authenticated shell for an
 * obviously signed-out visitor.
 */

const PUBLIC_PATHS = ["/login", "/register", "/verify"];

const COOKIE_NAME = "lumina_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(COOKIE_NAME)?.value);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Preserve where they were headed so login can bounce them back.
    if (pathname !== "/") {
      url.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Everything except Next internals, static assets, the media route (which
     * streams video and does its own auth), and the health probe (which must
     * answer load balancers without a session).
     */
    "/((?!api/media|api/health|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
