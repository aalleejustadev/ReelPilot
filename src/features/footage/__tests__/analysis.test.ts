import { describe, expect, it } from "vitest"

import { aimAt } from "../lib/aim"
import {
  actionAt,
  analysisSchema,
  diffFrames,
  gridFor,
  paletteFrom,
  parseStoredAnalysis,
  sampleEveryMs,
  summarizeActivity,
  type FootageAnalysis,
  type FrameDiff,
} from "../lib/analysis"
import { parseStoredInsight, type MomentInsight } from "../lib/insight"
import { footageBackgrounds, shade } from "../lib/looks"
import { cursorAt, recordingSchema } from "../lib/recording"

const grid = { w: 160, h: 90 }

/** A grayscale frame: flat `base`, with optional filled rectangles. */
function frame(
  base: number,
  rects: { x: number; y: number; w: number; h: number; value: number }[] = []
) {
  const pixels = new Uint8Array(grid.w * grid.h).fill(base)
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) pixels[y * grid.w + x] = r.value
    }
  }
  return pixels
}

/** A page of horizontal stripes, scrolled down by `offset` rows. */
function page(offset: number) {
  const pixels = new Uint8Array(grid.w * grid.h)
  for (let y = 0; y < grid.h; y++) {
    // Irregular stripes so only the true shift lines them up.
    const row = y + offset
    const value = (row * 37) % 97 < 40 ? 30 : 220
    pixels.fill(value, y * grid.w, (y + 1) * grid.w)
  }
  return pixels
}

describe("analysis frames", () => {
  it("keeps the frame's shape with a 160px long side", () => {
    expect(gridFor(1920, 1080)).toEqual({ w: 160, h: 90 })
    expect(gridFor(1080, 1920)).toEqual({ w: 90, h: 160 })
    expect(gridFor(1440, 900)).toEqual({ w: 160, h: 100 })
  })

  it("samples 5 times a second, less often for long clips", () => {
    expect(sampleEveryMs(60_000)).toBe(200)
    expect(sampleEveryMs(600_000)).toBe(400)
  })
})

describe("diffFrames", () => {
  it("sees nothing when nothing changes", () => {
    expect(diffFrames(frame(200), frame(200), grid)).toEqual({
      energy: 0,
      box: null,
      scroll: 0,
    })
  })

  it("boxes the part of the screen that changed", () => {
    // A 32×16 panel appears in the top right.
    const after = frame(200, [{ x: 120, y: 8, w: 32, h: 16, value: 40 }])
    const diff = diffFrames(frame(200), after, grid)
    expect(diff.energy).toBeCloseTo((32 * 16) / (160 * 90), 3)
    expect(diff.box).toEqual({ x: 0.75, y: 0.089, w: 0.2, h: 0.178 })
    expect(diff.scroll).toBe(0)
  })

  it("ignores compression noise below the threshold", () => {
    const noisy = frame(200).map((value, i) => value + (i % 7) * 2)
    expect(diffFrames(frame(200), noisy, grid).box).toBeNull()
  })

  it("tells a scroll from a change", () => {
    expect(diffFrames(page(0), page(6), grid).scroll).toBe(6)
    expect(diffFrames(page(6), page(0), grid).scroll).toBe(-6)
  })
})

describe("summarizeActivity", () => {
  const still: FrameDiff = { energy: 0, box: null, scroll: 0 }
  const busy: FrameDiff = {
    energy: 0.1,
    box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    scroll: 0,
  }
  const scrolling: FrameDiff = { ...busy, energy: 0.4, scroll: 5 }

  it("stamps each diff with the later frame's time", () => {
    const { activity } = summarizeActivity([busy, still], 200)
    expect(activity).toEqual([
      [200, 0.1, 0.1, 0.1, 0.2, 0.2],
      [400, 0, 0, 0, 0, 0],
    ])
  })

  it("finds still stretches of 1.5s or more", () => {
    const diffs = [
      busy,
      ...Array(10).fill(still),
      busy,
      ...Array(5).fill(still),
    ]
    // 10 still samples × 200ms = 2s from 200ms; the 1s one is too short.
    expect(summarizeActivity(diffs, 200).idle).toEqual([
      { startMs: 200, endMs: 2200 },
    ])
  })

  it("joins scrolling samples into stretches and drops single ones", () => {
    // One still sample inside a scroll is kept; two end it.
    const diffs = [
      scrolling,
      scrolling,
      still,
      scrolling,
      busy,
      busy,
      scrolling,
    ]
    expect(summarizeActivity(diffs, 200).scrolls).toEqual([
      { startMs: 0, endMs: 800, direction: "down" },
    ])
  })
})

describe("paletteFrom", () => {
  /** RGB pixels: `share` of them `color`, the rest `rest`. */
  function pixels(
    color: [number, number, number],
    share: number,
    rest: [number, number, number]
  ) {
    const count = 1000
    const rgb = new Uint8Array(count * 3)
    for (let i = 0; i < count; i++) {
      rgb.set(i < count * share ? color : rest, i * 3)
    }
    return rgb
  }

  it("finds the main tones and the saturated accent", () => {
    const palette = paletteFrom(pixels([37, 99, 235], 0.1, [250, 250, 250]))
    expect(palette.colors[0]).toEqual({ hex: "#fafafa", weight: 0.9 })
    expect(palette.accents).toEqual(["#2563eb"])
    expect(palette.isDark).toBe(false)
  })

  it("knows a dark app", () => {
    const palette = paletteFrom(pixels([16, 185, 129], 0.05, [17, 24, 39]))
    expect(palette.isDark).toBe(true)
    expect(palette.accents).toEqual(["#10b981"])
  })

  it("gives no accents for a grey screen", () => {
    expect(
      paletteFrom(pixels([120, 120, 120], 0.5, [240, 240, 240])).accents
    ).toEqual([])
  })
})

const analysis = (
  activity: FootageAnalysis["activity"],
  scrolls: FootageAnalysis["scrolls"] = []
): FootageAnalysis => ({
  version: 1,
  sampleMs: 200,
  activity,
  idle: [],
  scrolls,
  palette: { colors: [], accents: [], isDark: false },
})

describe("actionAt", () => {
  it("aims at the strongest local change just after the moment", () => {
    const action = actionAt(
      analysis([
        [1000, 0.02, 0.6, 0.1, 0.2, 0.1], // before the window
        [2200, 0.01, 0.1, 0.7, 0.1, 0.1], // weaker, elsewhere
        [2400, 0.05, 0.6, 0.2, 0.2, 0.1],
        [2600, 0.03, 0.75, 0.25, 0.1, 0.1], // touches the strongest: joins
      ]),
      2000
    )
    expect(action).toEqual({
      box: { x: 0.6, y: 0.2, w: 0.25, h: 0.15 },
      focusX: 0.725,
      focusY: 0.275,
      zoom: 2.2,
    })
  })

  it("zooms less on a big area", () => {
    const action = actionAt(analysis([[500, 0.2, 0.1, 0.1, 0.5, 0.5]]), 0)
    expect(action?.zoom).toBe(1.2)
  })

  it("ignores page changes and scrolls", () => {
    expect(
      actionAt(
        analysis(
          [
            [400, 0.9, 0, 0, 1, 1],
            [800, 0.3, 0.1, 0.1, 0.3, 0.3],
          ],
          [{ startMs: 600, endMs: 1000, direction: "down" }]
        ),
        200
      )
    ).toBeNull()
  })
})

describe("aimAt", () => {
  const insight: MomentInsight = {
    version: 1,
    description: "Export menu open",
    headline: "Export in one click",
    onScreenText: ["Export"],
    focus: { x: 0.8, y: 0, w: 0.2, h: 0.1 },
    kind: "modal",
  }

  it("prefers what changes on screen, then the AI's pick, then the cursor", () => {
    const busy = analysis([[1200, 0.05, 0.1, 0.1, 0.2, 0.2]])
    const recording = {
      version: 1 as const,
      surface: "browser" as const,
      cursor: [[1000, 0.5, 0.5] as [number, number, number]],
    }
    const at = (a: FootageAnalysis | null, i: MomentInsight | null) =>
      aimAt({ analysis: a, insight: i, recording, atMs: 1000 })?.source
    expect(at(busy, insight)).toBe("activity")
    expect(at(analysis([]), insight)).toBe("ai")
    expect(at(null, null)).toBe("cursor")
    expect(
      aimAt({ analysis: null, insight: null, recording: null, atMs: 0 })
    ).toBeNull()
  })

  it("centres on the AI's element", () => {
    expect(
      aimAt({ analysis: null, insight, recording: null, atMs: 0 })
    ).toMatchObject({ focusX: 0.9, focusY: 0.05, zoom: 2.2 })
  })
})

describe("stored data", () => {
  it("reads only the current analysis format", () => {
    const good = analysis([[200, 0.1, 0, 0, 0.5, 0.5]])
    expect(parseStoredAnalysis(good)).toEqual(good)
    expect(parseStoredAnalysis({ ...good, version: 2 })).toBeNull()
    expect(parseStoredAnalysis(null)).toBeNull()
    expect(analysisSchema.safeParse({ ...good, sampleMs: 0 }).success).toBe(
      false
    )
  })

  it("reads insights and rejects broken ones", () => {
    expect(parseStoredInsight({ description: "x" })).toBeNull()
  })

  it("keeps cursor tracks in the frame", () => {
    expect(
      recordingSchema.safeParse({
        version: 1,
        surface: "window",
        cursor: [[0, 1.2, 0.5]],
      }).success
    ).toBe(false)
  })

  it("takes the cursor's usual spot, not a flick across the screen", () => {
    const recording = {
      version: 1 as const,
      surface: "monitor" as const,
      cursor: [
        [900, 0.2, 0.2],
        [1000, 0.21, 0.2],
        [1100, 0.95, 0.9], // a flick
        [1200, 0.22, 0.21],
        [5000, 0.9, 0.9], // later
      ] as [number, number, number][],
    }
    expect(cursorAt(recording, 1000)).toEqual({ x: 0.22, y: 0.21 })
    expect(cursorAt(recording, 3000)).toBeNull()
  })
})

describe("footage backgrounds", () => {
  it("mixes colours toward white or black", () => {
    expect(shade("#2563eb", 0)).toBe("#2563eb")
    expect(shade("#000000", 0.5)).toBe("#808080")
    expect(shade("#ffffff", -1)).toBe("#000000")
  })

  it("offers the footage's accent and tone", () => {
    const presets = footageBackgrounds({
      colors: [{ hex: "#111827", weight: 0.8 }],
      accents: ["#10b981"],
      isDark: true,
    })
    expect(presets.map((p) => p.name)).toEqual([
      "Footage accent",
      "Footage tone",
    ])
    expect(presets[0]?.background).toEqual({
      kind: "gradient",
      from: "#10b981",
      to: shade("#10b981", -0.45),
    })
    expect(footageBackgrounds(null)).toEqual([])
  })
})
