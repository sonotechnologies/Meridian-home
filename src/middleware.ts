import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect to /login for signed-out visitors on account pages. This only
 * checks that a session cookie exists; the role check that actually protects
 * each area runs on the server in its layout and in every server action.
 */
export function middleware(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/saved", "/searches"],
};
