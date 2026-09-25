import "server-only"

import { cache } from "react"

import { requireUser } from "@/features/auth"

import { assertCan, type WorkspaceAction } from "./lib/permissions"
import { ensurePersonalWorkspace } from "./service"

/**
 * The signed-in user's workspace and role, created on first use. Redirects
 * to sign-in when signed out. Cached for the duration of one request.
 * M0 has personal workspaces only, so this is always the active one.
 */
export const getCurrentWorkspace = cache(async () => {
  const { user } = await requireUser()
  const { workspace, role } = await ensurePersonalWorkspace(user)
  return { user, workspace, role }
})

/**
 * Start of every page and server action that touches workspace data:
 * signed in, has a workspace, and the role allows `action`. Throws
 * FORBIDDEN otherwise. Scope every query by the returned workspace.id.
 */
export async function requireWorkspaceAccess(action: WorkspaceAction) {
  const context = await getCurrentWorkspace()
  assertCan(context.role, action)
  return context
}
