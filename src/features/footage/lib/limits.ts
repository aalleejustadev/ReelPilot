import { plans, type PlanKey } from "@/shared/config/plans"
import { AppError } from "@/shared/lib/errors"

export function footageLimitsFor(plan: PlanKey) {
  return plans[plan].footage
}

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

export function assertCanAddFootage(plan: PlanKey, clipCount: number) {
  const { clipsPerBrandKit } = footageLimitsFor(plan)
  if (clipCount < clipsPerBrandKit) return
  throw new AppError(
    "PLAN_LIMIT",
    `Your ${plans[plan].name} plan includes ${clipsPerBrandKit} clips per brand kit. Delete one to add another.`
  )
}

export function assertFootageSize(plan: PlanKey, sizeBytes: number) {
  const { maxBytes } = footageLimitsFor(plan)
  if (sizeBytes <= maxBytes) return
  throw new AppError(
    "VALIDATION",
    `Your footage is larger than ${formatBytes(maxBytes)}. Trim it or upload a smaller clip.`
  )
}

/** Build plan §12.7's example message. */
export function tooLongMessage(plan: PlanKey) {
  const { maxDurationSeconds } = footageLimitsFor(plan)
  return `Your footage is longer than ${formatMinutes(maxDurationSeconds)}. Trim it or upload a shorter clip.`
}
