import { describe, expect, it } from "vitest"

import {
  assertFootageSize,
  footageUsage,
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

  it("caps file size at 1 GB", () => {
    expect(() => assertFootageSize(1024 * 1024 * 1024)).not.toThrow()
    expect(() => assertFootageSize(1024 * 1024 * 1024 + 1)).toThrow(
      "Your footage is larger than 1 GB. Trim it or upload a smaller clip."
    )
  })

  it("explains the caps, with no plans involved", () => {
    expect(tooLongMessage()).toBe(
      "Your footage is longer than 10 minutes. Trim it or upload a shorter clip."
    )
    expect(footageUsage()).toBe("Up to 1 GB and 10 minutes per clip.")
  })
})
