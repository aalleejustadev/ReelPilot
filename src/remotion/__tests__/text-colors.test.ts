import { describe, expect, it } from "vitest"

import { textColors } from "../components/TextLayer"

describe("textColors", () => {
  it("uses white on dark backgrounds and dark text on light ones", () => {
    expect(
      textColors({ kind: "gradient", from: "#0f172a", to: "#334155" }, [])
    ).toMatchObject({ base: "#ffffff", shadow: true })
    expect(
      textColors({ kind: "solid", from: "#f5f5f4", to: "#f5f5f4" }, [])
    ).toMatchObject({ base: "#15171c", shadow: false })
  })

  it("uses the first accent that stands out, else highlighter yellow", () => {
    const dark = { kind: "solid" as const, from: "#15171c", to: "#15171c" }
    expect(textColors(dark, ["#22c55e"]).accent).toBe("#22c55e")
    // Navy on near-black doesn't read: the footage's colour is next.
    expect(textColors(dark, ["#1e293b", "#f97316"]).accent).toBe("#f97316")
    expect(textColors(dark, ["#1e293b"])).toMatchObject({
      accent: "#facc15",
      onAccent: "#15171c",
    })
  })
})
