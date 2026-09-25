import { describe, expect, it } from "vitest"

import {
  assertCanAddFootage,
  assertFootageSize,
  formatBytes,
  formatMinutes,
  tooLongMessage,
} from "../lib/limits"

describe("footage limits", () => {
  it("formats sizes and lengths the way people read them", () => {
    expect(formatBytes(200 * 1024 * 1024)).toBe("200 MB")
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB")
    expect(formatMinutes(180)).toBe("3 minutes")
    expect(formatMinutes(60)).toBe("1 minute")
  })

  it("caps file size by plan", () => {
    expect(() => assertFootageSize("FREE", 200 * 1024 * 1024)).not.toThrow()
    expect(() => assertFootageSize("FREE", 200 * 1024 * 1024 + 1)).toThrow(
      "Your footage is larger than 200 MB. Trim it or upload a smaller clip."
    )
    expect(() => assertFootageSize("GROWTH", 900 * 1024 * 1024)).not.toThrow()
  })

  it("caps clips per kit by plan", () => {
    expect(() => assertCanAddFootage("FREE", 4)).not.toThrow()
    expect(() => assertCanAddFootage("FREE", 5)).toThrow(
      expect.objectContaining({
        code: "PLAN_LIMIT",
        message:
          "Your Free plan includes 5 clips per brand kit. Delete one to add another.",
      })
    )
  })

  it("explains the length cap in the plan's terms", () => {
    expect(tooLongMessage("STARTER")).toBe(
      "Your footage is longer than 5 minutes. Trim it or upload a shorter clip."
    )
  })
})
