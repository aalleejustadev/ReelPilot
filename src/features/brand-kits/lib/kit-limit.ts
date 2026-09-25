import { plans, type PlanKey } from "@/shared/config/plans"
import { AppError } from "@/shared/lib/errors"

export function brandKitLimit(plan: PlanKey) {
  return plans[plan].brandKits
}

/** Throws PLAN_LIMIT when a workspace with `kitCount` kits can't add one. */
export function assertCanAddBrandKit(plan: PlanKey, kitCount: number) {
  const limit = brandKitLimit(plan)
  if (kitCount < limit) return
  const kits = limit === 1 ? "1 brand kit" : `${limit} brand kits`
  throw new AppError(
    "PLAN_LIMIT",
    `Your ${plans[plan].name} plan includes ${kits}. Delete one to add another.`
  )
}
