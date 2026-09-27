import { describe, expect, it } from "vitest"

import { flatCamera } from "../presets"
import { frameGeometry, frameProjection, perspectiveFor } from "../stage"

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
