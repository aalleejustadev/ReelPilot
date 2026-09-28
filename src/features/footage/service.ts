import "server-only"

import { db, Prisma } from "@/shared/db"
import type { Presentation, Shot } from "@/shared/motion"
import { AppError } from "@/shared/lib/errors"

import { footageFileKey, footageFolder, originalFileName } from "./lib/keys"
import { assertFootageSize } from "./lib/limits"
import type { FootageAnalysis } from "./lib/analysis"
import type { MomentInsight } from "./lib/insight"
import type { RecordingInfo } from "./lib/recording"
import { footageLimits, type RequestUploadInput } from "./schema"

const kitNotFound = () =>
  new AppError("NOT_FOUND", "We couldn’t find that brand kit.")
const footageNotFound = () =>
  new AppError(
    "NOT_FOUND",
    "We couldn’t find that clip. It may have been deleted."
  )

/**
 * Creates the clip row (status UPLOADING) and its storage key, if the kit is
 * the workspace's and the file isn't over the size cap.
 */
export async function createFootageUpload(
  workspaceId: string,
  input: RequestUploadInput
) {
  return db.$transaction(async (tx) => {
    const kit = await tx.brandKit.count({
      where: { id: input.kitId, workspaceId },
    })
    if (!kit) throw kitNotFound()
    assertFootageSize(input.sizeBytes)

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
    return { footageId: created.id, originalKey }
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
  recordedMarksMs: number[],
  recording?: RecordingInfo
) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.footage.updateMany({
      where: { id: footageId, workspaceId, status: "UPLOADING" },
      data: { status: "PROCESSING", ...(recording && { recording }) },
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
        // The analysis job runs next (§7.4b).
        analysisStatus: "PENDING",
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

// ── Motion (§7.4a) ──────────────────────────────────────────────────────────

/** Sets (or clears, with null) the camera shot a marker moves into. */
export async function setMarkerShot(
  workspaceId: string,
  markerId: string,
  shot: Shot | null
) {
  const { count } = await db.footageMarker.updateMany({
    where: markerInWorkspace(markerId, workspaceId),
    data: { shot: shot ?? Prisma.DbNull },
  })
  if (count === 0) throw new AppError("NOT_FOUND", "That marker is gone.")
}

/**
 * Saves the clip's edit if it's still at `baseVersion`, and returns the
 * new version. Another tab (or person) saving since gets a conflict
 * instead of silently overwriting their work — last save no longer wins.
 */
export async function setFootagePresentation(
  workspaceId: string,
  footageId: string,
  presentation: Presentation,
  baseVersion: number
) {
  const { count } = await db.footage.updateMany({
    where: { id: footageId, workspaceId, presentationVersion: baseVersion },
    data: { presentation, presentationVersion: { increment: 1 } },
  })
  if (count === 0) {
    const exists = await db.footage.count({
      where: { id: footageId, workspaceId },
    })
    if (!exists) throw footageNotFound()
    throw changedElsewhere()
  }
  return baseVersion + 1
}

const changedElsewhere = () =>
  new AppError(
    "CONFLICT",
    "This clip was changed in another tab or window. Reload to get the latest."
  )

/**
 * Moves a marker to `atMs` (dragged on the timeline). A moved marker is the
 * owner's choice now, so it becomes MANUAL: reprocessing only replaces AUTO.
 */
export async function moveMarker(
  workspaceId: string,
  markerId: string,
  atMs: number
) {
  const marker = await db.footageMarker.findFirst({
    where: markerInWorkspace(markerId, workspaceId),
    select: {
      atMs: true,
      footageId: true,
      footage: { select: { durationMs: true } },
    },
  })
  if (!marker?.footage) throw new AppError("NOT_FOUND", "That marker is gone.")
  const end = marker.footage.durationMs
  if (end !== null && atMs > end) {
    throw new AppError("VALIDATION", "That moment is past the end of the clip.")
  }
  // A second away the screen shows something else: describe it again.
  const stale = Math.abs(atMs - marker.atMs) > 1000
  await db.footageMarker.update({
    where: { id: markerId },
    data: {
      atMs,
      source: "MANUAL",
      ...(stale && { insight: Prisma.DbNull }),
    },
  })
  return { footageId: marker.footageId, needsInsight: stale }
}

// ── Smart analysis (§7.4b) ──────────────────────────────────────────────────

/**
 * Asks for a fresh analysis: clears the old one (and, with `redescribe`,
 * every moment's AI description) and marks it PENDING. Returns false if
 * the clip isn't READY.
 */
export async function requestAnalysis(
  workspaceId: string,
  footageId: string,
  options: { redescribe: boolean }
) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.footage.updateMany({
      where: { id: footageId, workspaceId, status: "READY" },
      data: {
        analysisStatus: "PENDING",
        ...(options.redescribe && { analysis: Prisma.DbNull }),
      },
    })
    if (count === 0) return false
    if (options.redescribe) {
      // Labels the AI filled in (still unedited) are refilled, not kept.
      await tx.$executeRaw`
        UPDATE footage_markers SET label = NULL
        WHERE "footageId" = ${footageId}
          AND label = left(insight->>'description', ${footageLimits.label})`
      await tx.footageMarker.updateMany({
        where: { footageId },
        data: { insight: Prisma.DbNull },
      })
    }
    return true
  })
}

/** Worker side: the clip, its kit's name and its markers, for analysis. */
export async function getFootageForAnalysis(footageId: string) {
  return db.footage.findUnique({
    where: { id: footageId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      videoKey: true,
      durationMs: true,
      width: true,
      height: true,
      analysis: true,
      brandKit: { select: { name: true } },
      markers: {
        orderBy: { atMs: "asc" },
        select: { id: true, atMs: true, insight: true },
      },
    },
  })
}

export async function setAnalysisStatus(
  footageId: string,
  status: "RUNNING" | "READY" | "FAILED"
) {
  await db.footage.updateMany({
    where: { id: footageId, status: "READY" },
    data: { analysisStatus: status },
  })
}

export async function saveFootageAnalysis(
  footageId: string,
  analysis: FootageAnalysis
) {
  await db.footage.updateMany({
    where: { id: footageId },
    data: { analysis },
  })
}

/**
 * Saves what the AI saw at a moment, unless the moment moved meanwhile
 * (then it's described again). An empty "What's on screen" is filled in;
 * one the owner wrote is kept.
 */
export async function saveMomentInsight(
  markerId: string,
  atMs: number,
  insight: MomentInsight
) {
  await db.$transaction([
    db.footageMarker.updateMany({
      where: { id: markerId, atMs },
      data: { insight },
    }),
    db.footageMarker.updateMany({
      where: { id: markerId, atMs, OR: [{ label: null }, { label: "" }] },
      data: { label: insight.description.slice(0, footageLimits.label) },
    }),
  ])
}

/** Clips whose analysis was asked for but never started (lost enqueue). */
export async function stuckAnalyses(olderThan: Date) {
  const clips = await db.footage.findMany({
    where: {
      status: "READY",
      analysisStatus: "PENDING",
      updatedAt: { lt: olderThan },
    },
    select: { id: true },
    take: 20,
  })
  return clips.map((clip) => clip.id)
}
