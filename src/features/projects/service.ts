import "server-only"

import { db, type Prisma } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"
import type { ProjectClipInput } from "@/shared/motion"

const projectNotFound = () =>
  new AppError("NOT_FOUND", "We couldn’t find that project.")

/** A new, empty project for one of the workspace's brand kits. */
export async function createProject(
  workspaceId: string,
  input: { name: string; kitId: string }
) {
  const kit = await db.brandKit.count({
    where: { id: input.kitId, workspaceId },
  })
  if (!kit) throw new AppError("NOT_FOUND", "We couldn’t find that brand kit.")
  return db.project.create({
    data: { workspaceId, brandKitId: input.kitId, name: input.name },
    select: { id: true },
  })
}

export async function renameProject(
  workspaceId: string,
  projectId: string,
  name: string
) {
  const { count } = await db.project.updateMany({
    where: { id: projectId, workspaceId },
    data: { name },
  })
  if (count === 0) throw projectNotFound()
}

export async function deleteProject(workspaceId: string, projectId: string) {
  const { count } = await db.project.deleteMany({
    where: { id: projectId, workspaceId },
  })
  if (count === 0) throw projectNotFound()
}

/**
 * Replaces the clip list if the project is still at `baseVersion`, and
 * returns the new version. Clips must be ready footage of the project's
 * own brand kit. A stale version (saved elsewhere since) is a conflict.
 */
export async function saveProjectClips(
  workspaceId: string,
  input: { projectId: string; baseVersion: number; clips: ProjectClipInput[] }
) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, workspaceId },
    select: { brandKitId: true },
  })
  if (!project) throw projectNotFound()

  const ids = [...new Set(input.clips.map((clip) => clip.footageId))]
  const usable = await db.footage.count({
    where: {
      id: { in: ids },
      workspaceId,
      brandKitId: project.brandKitId,
      status: "READY",
    },
  })
  if (usable !== ids.length) {
    throw new AppError(
      "VALIDATION",
      "Only this brand kit’s ready clips can go in the project."
    )
  }

  return db.$transaction(
    async (tx) => {
      const { count } = await tx.project.updateMany({
        where: {
          id: input.projectId,
          workspaceId,
          version: input.baseVersion,
        },
        data: { version: { increment: 1 } },
      })
      if (count === 0) {
        throw new AppError(
          "CONFLICT",
          "This project was changed in another tab or window. Reload to get the latest."
        )
      }
      await tx.projectClip.deleteMany({ where: { projectId: input.projectId } })
      if (input.clips.length > 0) {
        await tx.projectClip.createMany({
          data: input.clips.map((clip, position) => ({
            projectId: input.projectId,
            footageId: clip.footageId,
            position,
            transition: clip.transition as Prisma.InputJsonValue,
          })),
        })
      }
      return input.baseVersion + 1
    },
    // Neon is a network hop away: allow for its latency.
    { timeout: 15_000, maxWait: 10_000 }
  )
}
