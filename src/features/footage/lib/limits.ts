import { clipLimits } from "@/shared/config/limits"
import { AppError } from "@/shared/lib/errors"

export { clipLimits }

/** 200 MB, 1 GB (binary units, as file managers show them). */
export function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024
  if (mb >= 1024) return `${Math.round((mb / 1024) * 10) / 10} GB`
  return `${Math.round(mb)} MB`
}

/** 180 → "3 minutes", 90 → "1.5 minutes". */
export function formatMinutes(seconds: number) {
  const minutes = Math.round((seconds / 60) * 10) / 10
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
}

export function assertFootageSize(sizeBytes: number) {
  if (sizeBytes <= clipLimits.maxBytes) return
  throw new AppError(
    "VALIDATION",
    `Your footage is larger than ${formatBytes(clipLimits.maxBytes)}. Trim it or upload a smaller clip.`
  )
}

/** Build plan §12.7's example message. */
export function tooLongMessage() {
  return `Your footage is longer than ${formatMinutes(clipLimits.maxDurationSeconds)}. Trim it or upload a shorter clip.`
}

/** "Up to 1 GB and 10 minutes per clip." */
export function footageUsage() {
  return `Up to ${formatBytes(clipLimits.maxBytes)} and ${formatMinutes(clipLimits.maxDurationSeconds)} per clip.`
}
