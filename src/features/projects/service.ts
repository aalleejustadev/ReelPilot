import "server-only"

import { db, type Prisma } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"
import { workspaceFileKey } from "@/shared/storage"
import {
  defaultClipTransition,
  projectLimits,
  type ProjectClipInput,
} from "@/shared/motion"

const projectNotFound = () =>
  new AppError("NOT_FOUND", "We couldn’t find that video.")

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

/** Deletes the project; returns its folder (its exports' files live there). */
export async function deleteProject(workspaceId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { brandKitId: true },
  })
  const { count } = await db.project.deleteMany({
    where: { id: projectId, workspaceId },
  })
  if (!project || count === 0) throw projectNotFound()
  return {
    folder: `${workspaceFileKey(workspaceId, "brand-kits", project.brandKitId, "projects", projectId)}/`,
  }
}

/**
 * Replaces the clip list if the project is still at `baseVersion`, and
 * returns the new version. Clips must be footage of the project's own
 * brand kit (still processing is fine: a clip recorded into a video joins
 * it at once and plays once ready). A stale version is a conflict.
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
    where: { id: { in: ids }, workspaceId, brandKitId: project.brandKitId },
  })
  if (usable !== ids.length) {
    throw new AppError(
      "VALIDATION",
      "Only this brand kit’s clips can go in the video."
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
          "This video was changed in another tab or window. Reload to get the latest."
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

/**
 * Adds a clip at the end of a project (a clip just recorded or uploaded
 * into it), whatever version it's at, and returns the new version.
 */
export async function appendClip(
  workspaceId: string,
  projectId: string,
  footageId: string
) {
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { brandKitId: true },
  })
  if (!project) throw projectNotFound()
  const footage = await db.footage.count({
    where: { id: footageId, workspaceId, brandKitId: project.brandKitId },
  })
  if (!footage) {
    throw new AppError("NOT_FOUND", "We couldn’t find that clip.")
  }
  return db.$transaction(
    async (tx) => {
      const { version } = await tx.project.update({
        where: { id: projectId },
        data: { version: { increment: 1 } },
        select: { version: true },
      })
      const position = await tx.projectClip.count({ where: { projectId } })
      if (position >= projectLimits.clips) {
        throw new AppError(
          "PLAN_LIMIT",
          `A video holds up to ${projectLimits.clips} clips.`
        )
      }
      await tx.projectClip.create({
        data: {
          projectId,
          footageId,
          position,
          transition: defaultClipTransition as Prisma.InputJsonValue,
        },
      })
      return version
    },
    { timeout: 15_000, maxWait: 10_000 }
  )
}

/** Each clip's processing status, in order. */
export async function clipStatuses(workspaceId: string, projectId: string) {
  const clips = await db.projectClip.findMany({
    where: { projectId, project: { workspaceId } },
    orderBy: { position: "asc" },
    select: { footage: { select: { status: true } } },
  })
  return clips.map((clip) => clip.footage.status as string)
}
