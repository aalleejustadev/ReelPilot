import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { auth } from "./lib/auth"

/** The current session, or null. Cached for the duration of one request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
)

/**
 * The real access check for pages and actions. proxy.ts only does a fast
 * cookie-presence redirect; Next 16 docs say never to rely on it alone.
 */
export async function requireUser() {
  const session = await getSession()
  if (!session) redirect("/sign-in")
  return session
}
