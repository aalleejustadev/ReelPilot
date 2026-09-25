"use client"

import {
  completeFootageUpload,
  deleteFootage,
  requestFootageUpload,
} from "../actions"
import { uploadToStorage } from "./upload-to-storage"

/**
 * The whole upload, for files and recordings: ask for a signed upload,
 * send the file to storage, then confirm so the worker starts. If sending
 * fails, the half-made clip is removed. Returns an error message or null.
 */
export async function sendFootage(input: {
  kitId: string
  file: Blob
  /** The file's video type (see videoTypeOf); signed into the upload. */
  contentType: string
  name: string
  source: "UPLOAD" | "RECORDING"
  recordedMarksMs?: number[]
  onProgress: (fraction: number) => void
  signal?: AbortSignal
}): Promise<string | null> {
  const requested = await requestFootageUpload({
    kitId: input.kitId,
    name: input.name,
    sizeBytes: input.file.size,
    contentType: input.contentType,
    source: input.source,
  })
  if (!requested.ok) return requested.error.message
  const { footageId, upload } = requested.data

  try {
    await uploadToStorage(upload, input.file, {
      onProgress: input.onProgress,
      signal: input.signal,
    })
  } catch (error) {
    await deleteFootage(footageId)
    if (error instanceof DOMException && error.name === "AbortError") {
      return "Upload cancelled."
    }
    return "The upload was interrupted. Check your connection and try again."
  }

  const completed = await completeFootageUpload({
    footageId,
    recordedMarksMs: input.recordedMarksMs ?? [],
  })
  return completed.ok ? null : completed.error.message
}
