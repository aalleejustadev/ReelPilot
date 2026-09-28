import "server-only"

import { db } from "@/shared/db"
import { signedFileUrl } from "@/shared/storage"

import { downloadFileName } from "./lib/files"
import { renderFingerprint } from "./lib/fingerprint"
import { loadRenderInput } from "./lib/render-input"
import {
  exportShapes,
  exportShapeSchema,
  type ExportShape,
  type ExportTarget,
} from "./schema"
import { targetWhere } from "./service"

const hour = 60 * 60

export type ExportView = {
  /** The newest attempt in this shape. */
  status: "QUEUED" | "RENDERING" | "READY" | "FAILED"
  progress: number
  errorMessage: string | null
  /**
   * The newest finished MP4 in this shape — kept while a newer attempt
   * runs or after one fails.
   */
  file: {
    /** Our download route (it names the file). */
    downloadUrl: string
    sizeBytes: number | null
    /** Made from what the editor shows now (false: edited since). */
    current: boolean
  } | null
}

export type ExportPanel = {
  /** The newest export in each shape that has one. */
  exports: Partial<Record<ExportShape, ExportView>>
  share: { token: string; enabled: boolean } | null
  /** Why it can't be exported now, or null. */
  notReady: string | null
}

/**
 * The export dialog's state for a clip or video: each shape's newest
 * export (with a download link once ready, and whether it's out of date),
 * the share link, and whether it can be exported. Null if not found.
 */
export async function getExportPanel(
  workspaceId: string,
  target: ExportTarget
): Promise<ExportPanel | null> {
  const [input, rows, share] = await Promise.all([
    loadRenderInput(workspaceId, target, { linkSeconds: hour }),
    db.export.findMany({
      where: { workspaceId, ...targetWhere(target) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shape: true,
        status: true,
        progress: true,
        name: true,
        errorMessage: true,
        sizeBytes: true,
        fileKey: true,
        fingerprint: true,
      },
    }),
    db.shareLink.findFirst({
      where: { workspaceId, ...targetWhere(target) },
      select: { token: true, enabled: true },
    }),
  ])
  if (!input) return null
  const fingerprint = renderFingerprint(input.stage)

  const exports: ExportPanel["exports"] = {}
  for (const shape of exportShapes) {
    // Newest first.
    const inShape = rows.filter((row) => row.shape === shape)
    const latest = inShape[0]
    if (!latest) continue
    const done = inShape.find((row) => row.status === "READY" && row.fileKey)
    exports[shape] = {
      status: latest.status,
      progress: latest.progress,
      errorMessage: latest.errorMessage,
      file: done?.fileKey
        ? {
            downloadUrl: `/api/exports/${done.id}/download`,
            sizeBytes: done.sizeBytes,
            current: done.fingerprint === fingerprint,
          }
        : null,
    }
  }
  return { exports, share, notReady: input.notReady }
}

/**
 * What a public share link plays: the target's newest finished export in
 * any shape. Null when the link doesn't exist or is off; `video` is null
 * while nothing has been exported yet.
 */
export async function getSharedVideo(token: string) {
  const link = await db.shareLink.findUnique({
    where: { token },
    select: {
      enabled: true,
      footage: { select: { name: true, posterKey: true } },
      project: {
        select: {
          name: true,
          clips: {
            orderBy: { position: "asc" },
            take: 1,
            select: { footage: { select: { posterKey: true } } },
          },
        },
      },
      footageId: true,
      projectId: true,
    },
  })
  if (!link?.enabled) return null
  const name = link.footage?.name ?? link.project?.name ?? "Video"
  const posterKey =
    link.footage?.posterKey ?? link.project?.clips[0]?.footage.posterKey ?? null

  const latest = await db.export.findFirst({
    where: {
      footageId: link.footageId,
      projectId: link.projectId,
      status: "READY",
      fileKey: { not: null },
    },
    orderBy: { finishedAt: "desc" },
    select: { fileKey: true, shape: true },
  })
  // Long enough to watch the whole video after opening the page.
  const linkSeconds = 6 * hour
  return {
    name,
    posterUrl: posterKey ? await signedFileUrl(posterKey, linkSeconds) : null,
    video: latest?.fileKey
      ? {
          url: await signedFileUrl(latest.fileKey, linkSeconds),
          shape: exportShapeSchema.safeParse(latest.shape).data ?? "16:9",
        }
      : null,
  }
}

/**
 * A finished export's file and download name, if it's in the workspace
 * (for the download route).
 */
export async function getExportFile(workspaceId: string, exportId: string) {
  const row = await db.export.findFirst({
    where: { id: exportId, workspaceId, status: "READY" },
    select: { fileKey: true, name: true, shape: true, sizeBytes: true },
  })
  const shape = exportShapeSchema.safeParse(row?.shape).data
  if (!row?.fileKey || !shape) return null
  return {
    url: await signedFileUrl(row.fileKey, 5 * 60),
    fileName: downloadFileName(row.name, shape),
  }
}
