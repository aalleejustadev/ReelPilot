import { describe, expect, it } from "vitest"

import { sniffLogoType } from "../lib/logo"

const bytes = (...values: number[]) => new Uint8Array(values)
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

describe("sniffLogoType", () => {
  it("recognises PNG, JPEG and WebP by their first bytes", () => {
    expect(
      sniffLogoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    ).toBe("image/png")
    expect(sniffLogoType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg")
    expect(
      sniffLogoType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))
    ).toBe("image/webp")
  })

  it("rejects SVG, GIF, HTML and empty files whatever they claim to be", () => {
    expect(sniffLogoType(bytes(...ascii("<svg onload=alert(1)>")))).toBeNull()
    expect(sniffLogoType(bytes(...ascii("GIF89a")))).toBeNull()
    expect(sniffLogoType(bytes(...ascii("<!doctype html>")))).toBeNull()
    expect(sniffLogoType(bytes())).toBeNull()
  })

  it("rejects a RIFF file that isn't WebP", () => {
    expect(
      sniffLogoType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))
    ).toBeNull()
  })
})
