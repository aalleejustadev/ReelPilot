import "server-only"

import { db, type Plan } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"

import { footageFileKey, footageFolder, originalFileName } from "./lib/keys"
import { assertCanAddFootage, assertFootageSize } from "./lib/limits"
import type { RequestUploadInput } from "./schema"

const kitNotFound = () =>
  new AppError("NOT_FOUND", "We couldn’t find that brand kit.")
const footageNotFound = () =>
  new AppError(
    "NOT_FOUND",
    "We couldn’t find that clip. It may have been deleted."
  )

/**
 * Creates the clip row (status UPLOADING) and its storage key, if the plan
 * allows another clip of this size in the kit. The kit row is locked for the
 * check, so parallel uploads can't pass the limit together.
 */
export async function createFootageUpload(
  workspaceId: string,
  input: RequestUploadInput
) {
  return db.$transaction(async (tx) => {
    const [kit] = await tx.$queryRaw<{ plan: Plan }[]>`
      SELECT w.plan FROM brand_kits k
      JOIN workspaces w ON w.id = k."workspaceId"
      WHERE k.id = ${input.kitId} AND k."workspaceId" = ${workspaceId}
      FOR UPDATE OF k`
    if (!kit) throw kitNotFound()

    assertFootageSize(kit.plan, input.sizeBytes)
    const clipCount = await tx.footage.count({
      where: { brandKitId: input.kitId },
    })
    assertCanAddFootage(kit.plan, clipCount)

    const created = await tx.footage.create({
      data: {
        workspaceId,
        brandKitId: input.kitId,
        name: input.name,
        source: input.source,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        originalKey: "", // set below, once the id exists
      },
      select: { id: true },
    })
    const originalKey = footageFileKey(
      workspaceId,
      input.kitId,
      created.id,
      originalFileName(input.contentType)
    )
    await tx.footage.update({
      where: { id: created.id },
      data: { originalKey },
    })
    return { footageId: created.id, originalKey, plan: kit.plan }
  })
}

/** An UPLOADING clip, for confirming its upload. Null if not found. */
export async function getUploadingFootage(
  workspaceId: string,
  footageId: string
) {
  return db.footage.findFirst({
    where: { id: footageId, workspaceId, status: "UPLOADING" },
    select: { id: true, originalKey: true, sizeBytes: true },
  })
}

/**
 * UPLOADING → PROCESSING, saving any moments marked while recording.
 * Returns false if the clip was already past UPLOADING (a repeated call).
 */
export async function startProcessing(
  workspaceId: string,
  footageId: string,
  recordedMarksMs: number[]
) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.footage.updateMany({
      where: { id: footageId, workspaceId, status: "UPLOADING" },
      data: { status: "PROCESSING" },
    })
    if (count === 0) {
      const exists = await tx.footage.count({
        where: { id: footageId, workspaceId },
      })
      if (!exists) throw footageNotFound()
      return false
    }
    const marks = [...new Set(recordedMarksMs)].sort((a, b) => a - b)
    if (marks.length > 0) {
      await tx.footageMarker.createMany({
        data: marks.map((atMs) => ({ footageId, atMs, source: "MANUAL" })),
      })
    }
    return true
  })
}

// ── Worker side: called by the processing job with an id it was given. ──────

export async function getFootageForProcessing(footageId: string) {
  return db.footage.findUnique({
    where: { id: footageId },
    select: {
      id: true,
      workspaceId: true,
      brandKitId: true,
      status: true,
      originalKey: true,
      workspace: { select: { plan: true } },
    },
  })
}

export type ProcessedFootage = {
  durationMs: number
  width: number
  height: number
  thumbnailCount: number
  thumbnailIntervalMs: number
  autoMarkersMs: number[]
}

/**
 * PROCESSING → READY with the made files. Auto markers are replaced (a retry
 * never duplicates them); markers the user made are kept, and any past the
 * real end of the clip are dropped.
 */
export async function saveProcessedFootage(
  footageId: string,
  result: ProcessedFootage
) {
  await db.$transaction(async (tx) => {
    const clip = await tx.footage.findUniqueOrThrow({
      where: { id: footageId },
      select: { workspaceId: true, brandKitId: true },
    })
    const key = (file: "video.mp4" | "poster.jpg" | "thumbnails.jpg") =>
      footageFileKey(clip.workspaceId, clip.brandKitId, footageId, file)

    await tx.footage.update({
      where: { id: footageId },
      data: {
        status: "READY",
        videoKey: key("video.mp4"),
        posterKey: key("poster.jpg"),
        thumbnailsKey: key("thumbnails.jpg"),
        thumbnailCount: result.thumbnailCount,
        thumbnailIntervalMs: result.thumbnailIntervalMs,
        durationMs: result.durationMs,
        width: result.width,
        height: result.height,
        errorMessage: null,
        processedAt: new Date(),
      },
    })
    await tx.footageMarker.deleteMany({
      where: {
        footageId,
        OR: [{ source: "AUTO" }, { atMs: { gt: result.durationMs } }],
      },
    })
    await tx.footageMarker.createMany({
      data: result.autoMarkersMs.map((atMs) => ({
        footageId,
        atMs,
        source: "AUTO" as const,
      })),
    })
  })
}

/** → FAILED with a message the user can act on. */
export async function failFootage(footageId: string, message: string) {
  await db.footage.updateMany({
    where: { id: footageId, status: { in: ["UPLOADING", "PROCESSING"] } },
    data: { status: "FAILED", errorMessage: message },
  })
}

/** Uploads that never finished (tab closed, network lost) become FAILED. */
export async function failStaleUploads(olderThan: Date) {
  const { count } = await db.footage.updateMany({
    where: { status: "UPLOADING", createdAt: { lt: olderThan } },
    data: {
      status: "FAILED",
      errorMessage: "The upload didn’t finish. Upload the clip again.",
    },
  })
  return count
}

// ── Markers ─────────────────────────────────────────────────────────────────

export async function addMarker(
  workspaceId: string,
  input: { footageId: string; atMs: number; label: string | null }
) {
  const clip = await db.footage.findFirst({
    where: { id: input.footageId, workspaceId, status: "READY" },
    select: { durationMs: true },
  })
  if (!clip) throw footageNotFound()
  if (clip.durationMs !== null && input.atMs > clip.durationMs) {
    throw new AppError("VALIDATION", "That moment is past the end of the clip.")
  }
  return db.footageMarker.create({
    data: { ...input, source: "MANUAL" },
    select: { id: true },
  })
}

const markerInWorkspace = (markerId: string, workspaceId: string) => ({
  id: markerId,
  footage: { workspaceId },
})

export async function updateMarkerLabel(
  workspaceId: string,
  markerId: string,
  label: string | null
) {
  const { count } = await db.footageMarker.updateMany({
    where: markerInWorkspace(markerId, workspaceId),
    data: { label },
  })
  if (count === 0) throw new AppError("NOT_FOUND", "That marker is gone.")
}

export async function deleteMarker(workspaceId: string, markerId: string) {
  const { count } = await db.footageMarker.deleteMany({
    where: markerInWorkspace(markerId, workspaceId),
  })
  if (count === 0) throw new AppError("NOT_FOUND", "That marker is gone.")
}

/** Deletes the clip and its markers. Returns its storage folder to empty. */
export async function deleteFootage(workspaceId: string, footageId: string) {
  return db.$transaction(async (tx) => {
    const clip = await tx.footage.findFirst({
      where: { id: footageId, workspaceId },
      select: { brandKitId: true },
    })
    if (!clip) throw footageNotFound()
    await tx.footage.delete({ where: { id: footageId } })
    return { folder: footageFolder(workspaceId, clip.brandKitId, footageId) }
  })
}
