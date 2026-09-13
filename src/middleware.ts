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
     * Pages, and nothing else: Next internals, static assets and the whole of
     * `/api` are excluded.
     *
     * This gate only checks that a cookie is *present*, which is worth nothing
     * as authorization — so no API route should ever have relied on it, and
     * none does. Every one authorizes for itself: media and the admin exports
     * check the session and the role, the cron sweep checks a shared secret, the
     * health probe is deliberately public, and the SSO handlers run for visitors
     * who by definition have no session yet.
     *
     * What being listed here would actually do to them is worse than nothing.
     * An unauthenticated API request gets a 307 to an HTML login page instead of
     * a status code — fine in a browser, useless to the scheduler running the
     * nightly sweep or the script pulling the monthly compliance CSV, both of
     * which would have to parse HTML to discover they had failed. The SSO
     * callback is worse still: the returning visitor now *has* a session, so the
     * signed-in branch would send them to /dashboard and silently drop the
     * `next` they were originally headed for.
     *
     * Excluding the prefix wholesale rather than route by route also means the
     * next API route added is correct by default instead of correct if somebody
     * remembers to come back here.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
