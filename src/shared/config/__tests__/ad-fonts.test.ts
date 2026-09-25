import { describe, expect, it } from "vitest"

import { adFonts, toAdFont } from "../ad-fonts"

describe("ad fonts", () => {
  it("offers 15 distinct fonts", () => {
    expect(new Set(adFonts.map((font) => font.name)).size).toBe(15)
  })

  it("matches names case-insensitively and returns the list's spelling", () => {
    expect(toAdFont("  open sans ")).toBe("Open Sans")
    expect(toAdFont("PLAYFAIR DISPLAY")).toBe("Playfair Display")
  })

  it("returns null for fonts that aren't on the list", () => {
    expect(toAdFont("Helvetica")).toBeNull()
    expect(toAdFont("")).toBeNull()
  })
})
