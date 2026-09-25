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
  footage: {
    /** Largest file a user may upload or record. */
    maxBytes: number
    /** Longest clip, checked again on the real file by the worker. */
    maxDurationSeconds: number
    clipsPerBrandKit: number
  }
}

const MB = 1024 * 1024

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
    footage: {
      maxBytes: 200 * MB,
      maxDurationSeconds: 3 * 60,
      clipsPerBrandKit: 5,
    },
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
    footage: {
      maxBytes: 500 * MB,
      maxDurationSeconds: 5 * 60,
      clipsPerBrandKit: 20,
    },
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
    footage: {
      maxBytes: 1024 * MB,
      maxDurationSeconds: 10 * 60,
      clipsPerBrandKit: 50,
    },
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
    footage: {
      maxBytes: 1024 * MB,
      maxDurationSeconds: 10 * 60,
      clipsPerBrandKit: 50,
    },
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

/** Caps on costly AI work, independent of plan. */
export const aiLimits = {
  /** "Create from URL" drafts per workspace per day (each is an AI call). */
  brandKitDraftsPerDay: 20,
  /** "Direct with AI" requests for footage motion per workspace per day. */
  motionDirectionsPerDay: 40,
} as const
