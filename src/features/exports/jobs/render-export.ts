import "server-only"

import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { renderVideo } from "@/shared/render"
import { uploadFromFile } from "@/shared/storage"

import { renderFingerprint } from "../lib/fingerprint"
import { exportFileKey } from "../lib/keys"
import { loadRenderInput } from "../lib/render-input"
import { exportShapeSchema, type ExportTarget } from "../schema"
import {
  failExport,
  finishExport,
  getExportForRender,
  markRendering,
  saveProgress,
} from "../service"

const retriesExhausted =
  "We couldn’t export this video. Try again in a few minutes."

/**
 * Renders one export: loads the clip or video as the editor plays it now,
 * renders it in the export's shape, stores the MP4 and marks it READY
 * (replacing the older export in that shape). A clip or video that can't
 * be exported fails at once; anything else throws so the queue retries,
 * and the last attempt records the failure.
 */
export async function renderExport(
  { exportId }: { exportId: string },
  { signal, isLastAttempt }: { signal: AbortSignal; isLastAttempt: boolean }
) {
  const row = await getExportForRender(exportId)
  // Deleted (with its clip or video), or already done by an earlier attempt.
  if (!row || row.status === "READY" || row.status === "FAILED") return
  const target: ExportTarget = row.footageId
    ? { kind: "clip", id: row.footageId }
    : { kind: "video", id: row.projectId! }
  const shape = exportShapeSchema.parse(row.shape)

  // Links last for the longest render the job allows.
  const input = await loadRenderInput(row.workspaceId, target, {
    linkSeconds: 2 * 60 * 60,
  })
  if (!input) return
  if (input.notReady) {
    await failExport(exportId, input.notReady)
    return
  }
  await markRendering(exportId, renderFingerprint(input.stage))

  const dir = await mkdtemp(join(tmpdir(), `reelpilot-export-${exportId}-`))
  try {
    const output = join(dir, "video.mp4")
    // A progress write at most every 2% (the dialog polls it).
    let saved = 0
    const { durationMs } = await renderVideo({
      props: { ...input.stage, shape },
      outputPath: output,
      signal,
      onProgress: (progress) => {
        if (progress - saved < 0.02 && progress < 1) return
        saved = progress
        void saveProgress(exportId, progress).catch(() => undefined)
      },
    })
    const key = exportFileKey(row.workspaceId, input.kitId, target, exportId)
    await uploadFromFile(key, output, "video/mp4")
    const { size } = await stat(output)
    await finishExport(exportId, { key, sizeBytes: size, durationMs })
  } catch (error) {
    if (isLastAttempt) await failExport(exportId, retriesExhausted)
    throw error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
