import { describe, expect, it } from "vitest"

import { plans } from "@/shared/config/plans"

import { assertCanAddBrandKit, brandKitLimit } from "../lib/kit-limit"

describe("brand kit limit", () => {
  it("reads the limit from plans.ts", () => {
    expect(brandKitLimit("FREE")).toBe(plans.FREE.brandKits)
    expect(brandKitLimit("AGENCY")).toBe(plans.AGENCY.brandKits)
  })

  it("allows a kit below the limit", () => {
    expect(() => assertCanAddBrandKit("GROWTH", 2)).not.toThrow()
  })

  it("blocks at the limit with a plan-specific message", () => {
    expect(() => assertCanAddBrandKit("FREE", 1)).toThrow(
      expect.objectContaining({
        code: "PLAN_LIMIT",
        message:
          "Your Free plan includes 1 brand kit. Delete one to add another.",
      })
    )
    expect(() => assertCanAddBrandKit("GROWTH", 3)).toThrow(
      "Your Growth plan includes 3 brand kits."
    )
  })
})
