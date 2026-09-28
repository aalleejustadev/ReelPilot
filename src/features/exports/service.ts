import "server-only"

import { randomBytes } from "node:crypto"

import { db } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"
import { deleteFile } from "@/shared/storage"

import type { ExportShape, ExportTarget } from "./schema"

/** The row's columns for a target. */
export const targetWhere = (target: ExportTarget) =>
  target.kind === "clip"
    ? { footageId: target.id, projectId: null }
    : { projectId: target.id, footageId: null }

/** What a running export's row says while it's queued or rendering. */
export const activeStatuses = ["QUEUED", "RENDERING"] as const

/** The export of `target` in `shape` that's queued or rendering, if any. */
export async function findRunningExport(
  workspaceId: string,
  target: ExportTarget,
  shape: ExportShape
) {
  return db.export.findFirst({
    where: {
      workspaceId,
      ...targetWhere(target),
      shape,
      status: { in: [...activeStatuses] },
    },
    select: { id: true },
  })
}

export async function createExport(
  workspaceId: string,
  target: ExportTarget,
  shape: ExportShape,
  name: string
) {
  return db.export.create({
    data: { workspaceId, ...targetWhere(target), shape, name },
    select: { id: true },
  })
}

/** Removes an export that never started (its job couldn't be queued). */
export async function discardExport(exportId: string) {
  await db.export.deleteMany({ where: { id: exportId, status: "QUEUED" } })
}

/** The worker's view of one export (null once deleted). */
export async function getExportForRender(exportId: string) {
  return db.export.findUnique({
    where: { id: exportId },
    select: {
      id: true,
      workspaceId: true,
      footageId: true,
      projectId: true,
      shape: true,
      status: true,
    },
  })
}

export async function markRendering(exportId: string, fingerprint: string) {
  await db.export.updateMany({
    where: { id: exportId },
    data: { status: "RENDERING", progress: 0, fingerprint },
  })
}

export async function saveProgress(exportId: string, progress: number) {
  await db.export.updateMany({
    where: { id: exportId, status: "RENDERING" },
    data: { progress: Math.min(1, Math.max(0, progress)) },
  })
}

/**
 * Marks the export READY with its file, then removes the target's older
 * exports in the same shape (rows and files): only the newest is kept.
 */
export async function finishExport(
  exportId: string,
  file: { key: string; sizeBytes: number; durationMs: number }
) {
  const done = await db.export.update({
    where: { id: exportId },
    data: {
      status: "READY",
      progress: 1,
      fileKey: file.key,
      sizeBytes: file.sizeBytes,
      durationMs: file.durationMs,
      errorMessage: null,
      finishedAt: new Date(),
    },
    select: { footageId: true, projectId: true, shape: true },
  })
  const older = await db.export.findMany({
    where: {
      id: { not: exportId },
      footageId: done.footageId,
      projectId: done.projectId,
      shape: done.shape,
      status: { in: ["READY", "FAILED"] },
    },
    select: { id: true, fileKey: true },
  })
  await db.export.deleteMany({ where: { id: { in: older.map((e) => e.id) } } })
  for (const { fileKey } of older) {
    if (fileKey) {
      await deleteFile(fileKey).catch((error: unknown) =>
        console.error("[exports] couldn't delete an old export", error)
      )
    }
  }
}

export async function failExport(exportId: string, message: string) {
  await db.export.updateMany({
    where: { id: exportId },
    data: { status: "FAILED", errorMessage: message },
  })
}

/** A token that's long and random enough to be unguessable in a URL. */
export const newShareToken = () => randomBytes(16).toString("base64url")

/**
 * Turns the target's public link on (making it the first time) or off.
 * The token stays the same, so turning it back on revives the same link.
 */
export async function setShareLink(
  workspaceId: string,
  target: ExportTarget,
  enabled: boolean
) {
  const where = targetWhere(target)
  const existing = await db.shareLink.findFirst({
    where: { workspaceId, ...where },
    select: { id: true },
  })
  if (existing) {
    return db.shareLink.update({
      where: { id: existing.id },
      data: { enabled },
      select: { token: true, enabled: true },
    })
  }
  if (!enabled) return null
  return db.shareLink.create({
    data: { workspaceId, ...where, token: newShareToken() },
    select: { token: true, enabled: true },
  })
}

/** Throws NOT_FOUND unless the target is in the workspace. */
export async function assertTarget(workspaceId: string, target: ExportTarget) {
  const count =
    target.kind === "clip"
      ? await db.footage.count({ where: { id: target.id, workspaceId } })
      : await db.project.count({ where: { id: target.id, workspaceId } })
  if (!count) {
    throw new AppError(
      "NOT_FOUND",
      target.kind === "clip"
        ? "We couldn’t find that clip."
        : "We couldn’t find that video."
    )
  }
}
