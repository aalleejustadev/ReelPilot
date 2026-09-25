import type { MemberRole } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"

/** Everything a member can do in a workspace (build plan §7.2). */
export const workspaceActions = [
  "workspace:view",
  "workspace:comment",
  "content:create",
  "content:edit",
  "render:start",
  "billing:manage",
  "workspace:manage",
] as const

export type WorkspaceAction = (typeof workspaceActions)[number]

const allowed: Record<MemberRole, readonly WorkspaceAction[]> = {
  // Billing and everything else.
  OWNER: workspaceActions,
  // Create, edit and render.
  EDITOR: [
    "workspace:view",
    "workspace:comment",
    "content:create",
    "content:edit",
    "render:start",
  ],
  // View and comment only.
  VIEWER: ["workspace:view", "workspace:comment"],
}

export function can(role: MemberRole, action: WorkspaceAction): boolean {
  return allowed[role].includes(action)
}

const deniedMessages: Record<WorkspaceAction, string> = {
  "workspace:view": "You don’t have access to this workspace.",
  "workspace:comment": "You can’t comment in this workspace.",
  "content:create":
    "Viewers can’t create things. Ask an owner for editor access.",
  "content:edit": "Viewers can’t make changes. Ask an owner for editor access.",
  "render:start": "Viewers can’t render ads. Ask an owner for editor access.",
  "billing:manage": "Only the workspace owner can manage billing.",
  "workspace:manage": "Only the workspace owner can change workspace settings.",
}

/** Throws FORBIDDEN with a message that says what to do. */
export function assertCan(role: MemberRole, action: WorkspaceAction): void {
  if (!can(role, action)) {
    throw new AppError("FORBIDDEN", deniedMessages[action])
  }
}
