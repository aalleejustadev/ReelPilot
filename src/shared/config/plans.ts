/**
 * Prices, credits and limits — the single source of truth (build plan §2).
 * TODO(owner): confirm final prices after measuring real per-render cost.
 *
 * Money is integer cents. Credit costs are decimal strings so the billing
 * ledger can parse them into Decimal without float rounding.
 */

export const planKeys = ["FREE", "STARTER", "GROWTH", "AGENCY"] as const
export type PlanKey = (typeof planKeys)[number]

export type PlanConfig = {
  name: string
  priceCentsPerMonth: number
  /** HD ad credits granted each month. */
  monthlyCredits: number
  /** Free animatic previews per month (fair-use cap). */
  monthlyPreviews: number
  brandKits: number
  seats: number
  extraSeatCentsPerMonth: number | null
  hdExport: boolean
  priorityQueue: boolean
}

export const plans = {
  FREE: {
    name: "Free",
    priceCentsPerMonth: 0,
    monthlyCredits: 0,
    monthlyPreviews: 2, // watermarked, 720p
    brandKits: 1,
    seats: 1,
    extraSeatCentsPerMonth: null,
    hdExport: false,
    priorityQueue: false,
  },
  STARTER: {
    name: "Starter",
    priceCentsPerMonth: 2900,
    monthlyCredits: 10,
    monthlyPreviews: 40,
    brandKits: 1,
    seats: 1,
    extraSeatCentsPerMonth: null,
    hdExport: true,
    priorityQueue: false,
  },
  GROWTH: {
    name: "Growth",
    priceCentsPerMonth: 7900,
    monthlyCredits: 30,
    monthlyPreviews: 120,
    brandKits: 3,
    seats: 3,
    extraSeatCentsPerMonth: null,
    hdExport: true,
    priorityQueue: true,
  },
  AGENCY: {
    name: "Agency",
    priceCentsPerMonth: 19900,
    monthlyCredits: 100,
    monthlyPreviews: 400,
    brandKits: 10,
    seats: 5,
    extraSeatCentsPerMonth: 1500,
    hdExport: true,
    priorityQueue: true,
  },
} as const satisfies Record<PlanKey, PlanConfig>

export const creditCosts = {
  /** One final HD render of one variant, all three aspect ratios. */
  hdRender: "1",
  /** Rewriting one spoken line re-renders only that segment. */
  segmentRevoice: "0.25",
} as const

export const credits = {
  /** Unused credits roll over one month, capped at one month's allowance. */
  rolloverMonths: 1,
  topUpPackSize: 5,
  topUpPriceCents: null, // TODO(owner): set top-up price
} as const
