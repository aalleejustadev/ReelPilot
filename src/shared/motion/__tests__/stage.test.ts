import { describe, expect, it } from "vitest"

import { defaultPresentation, flatCamera } from "../presets"
import { graphicItemSchema } from "../graphics"
import {
  frameGeometry,
  frameProjection,
  perspectiveFor,
  splitAreas,
  splitInMs,
  splitProgress,
  stageCamera,
  stageLayoutAt,
} from "../stage"

const geometry = frameGeometry({
  width: 1920,
  height: 1080,
  padding: 0.05,
  videoWidth: 1600,
  videoHeight: 900,
})
const pose = (
  overrides: Partial<typeof flatCamera & { x: number; y: number }> = {}
) => ({
  ...flatCamera,
  x: 0,
  y: 0,
  ...overrides,
})

describe("frameGeometry", () => {
  it("fits the frame inside the padded stage and centres it", () => {
    // Padding is a % of the width on every side (96px), so a 16:9 frame
    // on a 16:9 stage is limited by height: (1080 − 192)·16/9.
    expect(geometry.frameWidth).toBeCloseTo((888 * 16) / 9)
    expect(geometry.top).toBeCloseTo(96)
    expect(geometry.left).toBeCloseTo((1920 - (888 * 16) / 9) / 2)
    // A portrait recording on a wide stage: limited by height.
    const tall = frameGeometry({
      width: 1920,
      height: 1080,
      padding: 0.02,
      videoWidth: 1080,
      videoHeight: 1920,
    })
    expect(tall.frameHeight).toBeCloseTo(1080 - 2 * 38.4)
  })
})

describe("frameProjection", () => {
  const at = (p: ReturnType<typeof pose>) =>
    frameProjection({ pose: p, geometry, width: 1920, height: 1080 })

  it("is the identity (plus position) for a flat camera", () => {
    const flat = at(pose())
    expect(flat.toStage(0, 0)).toEqual({ x: geometry.left, y: geometry.top })
    const mid = flat.toStage(500, 300)
    expect(mid.x).toBeCloseTo(geometry.left + 500)
    expect(mid.y).toBeCloseTo(geometry.top + 300)
  })

  it("zooms about the focus point", () => {
    const zoomed = at(pose({ zoom: 2, focusX: 0.25, focusY: 0.5 }))
    const focus = {
      u: 0.25 * geometry.frameWidth,
      v: 0.5 * geometry.frameHeight,
    }
    const f = zoomed.toStage(focus.u, focus.v)
    expect(f.x).toBeCloseTo(geometry.left + focus.u)
    // 100px to the right of the focus lands 200px to the right.
    expect(zoomed.toStage(focus.u + 100, focus.v).x - f.x).toBeCloseTo(200)
  })

  it("inverts exactly for any camera", () => {
    for (const p of [
      pose({ tilt: 22, turn: -34, roll: -6, zoom: 1.25 }),
      pose({ tilt: 40, turn: -28, roll: 14, zoom: 1.1, focusX: 0.8 }),
      pose({ turn: 55, tilt: 10, x: -0.4 }),
    ]) {
      const projection = at(p)
      for (const [u, v] of [
        [0, 0],
        [900, 400],
        [1700, 950],
      ] as const) {
        const s = projection.toStage(u, v)
        const back = projection.toFrame(s.x, s.y)
        expect(back.x).toBeCloseTo(u, 6)
        expect(back.y).toBeCloseTo(v, 6)
      }
    }
  })

  it("draws the side turned away smaller (perspective)", () => {
    // turn +: the right edge goes back, so it looks shorter than the left.
    const turned = at(pose({ turn: 30 }))
    const h = geometry.frameHeight
    const w = geometry.frameWidth
    const left = turned.toStage(0, h).y - turned.toStage(0, 0).y
    const right = turned.toStage(w, h).y - turned.toStage(w, 0).y
    expect(right).toBeLessThan(left)
    expect(perspectiveFor(1920)).toBe(2688)
  })
})

describe("split screens", () => {
  const split = (side: "left" | "right", atMs = 1000, durationMs = 4000) =>
    graphicItemSchema.parse({
      id: "s",
      kind: "split",
      atMs,
      durationMs,
      side,
    })
  const base = {
    edit: { parts: [] },
    durationMs: 10_000,
    width: 1920,
    height: 1080,
    padding: 0.1,
    videoWidth: 1440,
    videoHeight: 900,
  }

  it("splits wide stages side by side and stacks tall or square ones", () => {
    const wide = splitAreas({ width: 1920, height: 1080, side: "right" })
    expect(wide.stacked).toBe(false)
    expect(wide.video).toEqual({ x: 960, y: 0, w: 960, h: 1080 })
    expect(wide.text.x).toBe(0)
    const tall = splitAreas({ width: 1080, height: 1920, side: "left" })
    expect(tall.stacked).toBe(true)
    expect(tall.video).toEqual({ x: 0, y: 0, w: 1080, h: 960 })
    expect(
      splitAreas({ width: 1080, height: 1080, side: "auto" }).stacked
    ).toBe(true)
  })

  it("glides in and out, and holds in between", () => {
    expect(splitProgress(1000, 4000, 999)).toBe(0)
    expect(splitProgress(1000, 4000, 1000 + splitInMs / 2)).toBeCloseTo(0.5)
    expect(splitProgress(1000, 4000, 3000)).toBe(1)
    expect(splitProgress(1000, 4000, 5000)).toBe(0)
  })

  it("fits the frame inside the video's half, on the chosen side", () => {
    const at = (side: "left" | "right") =>
      stageLayoutAt({ ...base, graphics: [split(side)], adMs: 3000 })
    const left = at("left")
    const right = at("right")
    const full = frameGeometry(base)
    const width = full.frameWidth * left.scale
    expect(width).toBeLessThan(960)
    expect(width).toBeGreaterThan(780)
    // Centred in its half.
    expect(960 + left.dx).toBeCloseTo(480, 0)
    expect(960 + right.dx).toBeCloseTo(1440, 0)
    expect(left.dy).toBeCloseTo(0)
    // Nothing moves outside the split.
    expect(
      stageLayoutAt({ ...base, graphics: [split("left")], adMs: 8000 })
    ).toEqual({
      scale: 1,
      dx: 0,
      dy: 0,
    })
  })

  it("keeps the frame's projection exact while split", () => {
    const layout = stageLayoutAt({
      ...base,
      graphics: [split("right")],
      adMs: 3000,
    })
    const geometry = frameGeometry(base)
    const projection = frameProjection({
      pose: { ...flatCamera, x: 0, y: 0, turn: 20, tilt: 8, zoom: 1.3 },
      geometry,
      width: 1920,
      height: 1080,
      layout,
    })
    const onStage = projection.toStage(400, 300)
    const back = projection.toFrame(onStage.x, onStage.y)
    expect(back.x).toBeCloseTo(400, 6)
    expect(back.y).toBeCloseTo(300, 6)
    // The frame's centre lands in the right half.
    const centre = projection.toStage(
      geometry.frameWidth / 2,
      geometry.frameHeight / 2
    )
    expect(centre.x).toBeGreaterThan(960)
  })

  it("settles the camera during a split, so the video fits its half", () => {
    const shots = [
      {
        atMs: 0,
        shot: {
          camera: { ...flatCamera, zoom: 1.6, turn: 20, focusX: 0.3 },
          transitionMs: 0,
          easing: "smooth" as const,
          drift: 0,
        },
      },
    ]
    const presentation = {
      ...defaultPresentation,
      intro: { kind: "none" as const, durationMs: 0 },
    }
    const plain = stageCamera({ presentation, shots, durationMs: 10_000 })
    const withSplit = stageCamera({
      presentation: { ...presentation, graphics: [split("left", 2000, 4000)] },
      shots,
      durationMs: 10_000,
    })
    expect(plain(4000).zoom).toBeCloseTo(1.6)
    expect(withSplit(4000).zoom).toBeCloseTo(1)
    expect(withSplit(4000).turn).toBeCloseTo(8)
    // Before and after, the shot is untouched.
    expect(withSplit(1000)).toEqual(plain(1000))
    expect(withSplit(7000)).toEqual(plain(7000))
  })
})
