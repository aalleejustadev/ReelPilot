import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Fast, optimistic redirect for signed-out visitors: checks only that a
 * session cookie exists. Pages and actions still call requireUser(), which
 * validates the session (Next 16 docs: never rely on Proxy alone).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // App routes only. Add each (app) route here as it ships.
  matcher: ["/dashboard/:path*"],
}
