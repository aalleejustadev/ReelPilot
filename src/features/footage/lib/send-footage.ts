"use client"

import {
  completeFootageUpload,
  deleteFootage,
  requestFootageUpload,
} from "../actions"
import type { RecordingInfo } from "./recording"
import { uploadToStorage } from "./upload-to-storage"

/**
 * The whole upload, for files and recordings: ask for a signed upload,
 * send the file to storage, then confirm so the worker starts. If sending
 * fails, the half-made clip is removed. Returns the new clip's id, or an
 * error message.
 */
export async function sendFootage(input: {
  kitId: string
  file: Blob
  /** The file's video type (see videoTypeOf); signed into the upload. */
  contentType: string
  name: string
  source: "UPLOAD" | "RECORDING"
  recordedMarksMs?: number[]
  /** What the recorder saw besides the video (recordings only). */
  recording?: RecordingInfo
  onProgress: (fraction: number) => void
  signal?: AbortSignal
}): Promise<{ footageId: string } | { error: string }> {
  const requested = await requestFootageUpload({
    kitId: input.kitId,
    name: input.name,
    sizeBytes: input.file.size,
    contentType: input.contentType,
    source: input.source,
  })
  if (!requested.ok) return { error: requested.error.message }
  const { footageId, upload } = requested.data

  try {
    await uploadToStorage(upload, input.file, {
      onProgress: input.onProgress,
      signal: input.signal,
    })
  } catch (error) {
    await deleteFootage(footageId)
    if (error instanceof DOMException && error.name === "AbortError") {
      return { error: "Upload cancelled." }
    }
    return {
      error: "The upload was interrupted. Check your connection and try again.",
    }
  }

  const completed = await completeFootageUpload({
    footageId,
    recordedMarksMs: input.recordedMarksMs ?? [],
    recording: input.recording,
  })
  return completed.ok ? { footageId } : { error: completed.error.message }
}
