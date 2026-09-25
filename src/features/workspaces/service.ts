import "server-only"

import { db, MemberRole, Prisma } from "@/shared/db"

import { personalWorkspaceName } from "./lib/workspace-name"

type WorkspaceUser = { id: string; name: string }

const withOwnerMembership = (userId: string) =>
  ({
    memberships: { where: { userId }, select: { role: true } },
  }) satisfies Prisma.WorkspaceInclude

/**
 * Returns the user's personal workspace, creating it (with the user as
 * OWNER) on first use. Safe to call concurrently: the unique
 * personalOwnerId means only one insert can win; the loser reads it back.
 */
export async function ensurePersonalWorkspace(user: WorkspaceUser) {
  const include = withOwnerMembership(user.id)

  const existing = await db.workspace.findUnique({
    where: { personalOwnerId: user.id },
    include,
  })
  if (existing) return toContext(existing)

  try {
    const created = await db.workspace.create({
      data: {
        name: personalWorkspaceName(user.name),
        personalOwnerId: user.id,
        memberships: { create: { userId: user.id, role: MemberRole.OWNER } },
      },
      include,
    })
    return toContext(created)
  } catch (error) {
    const isRace =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    if (!isRace) throw error
    const winner = await db.workspace.findUniqueOrThrow({
      where: { personalOwnerId: user.id },
      include,
    })
    return toContext(winner)
  }
}

function toContext(
  workspace: Prisma.WorkspaceGetPayload<{
    include: ReturnType<typeof withOwnerMembership>
  }>
) {
  const { memberships, ...rest } = workspace
  const membership = memberships[0]
  // The owner membership is created in the same insert as the workspace.
  if (!membership)
    throw new Error(`Workspace ${rest.id} has no owner membership`)
  return { workspace: rest, role: membership.role }
}

export async function renameWorkspace(workspaceId: string, name: string) {
  return db.workspace.update({
    where: { id: workspaceId },
    data: { name },
    select: { id: true, name: true },
  })
}
