import { describe, expect, it } from "vitest"

import {
  acceptableCoc,
  apertureFor,
  defaultLens,
  depthBlurAt,
  depthGradient,
  depthOfFieldLayers,
  lensSchema,
  progressiveBlurLayers,
} from "../lens"
import { flatCamera } from "../presets"

const pose = (overrides: Partial<typeof flatCamera> = {}) => ({
  ...flatCamera,
  x: 0,
  y: 0,
  ...overrides,
})
const stage = { stageWidth: 1920, perspectivePx: 2688 }

describe("depth", () => {
  it("follows CSS rotations: turn moves the right edge away, tilt the top", () => {
    // rotateY(+): points right of the focus go back (z < 0).
    const turned = depthGradient(pose({ turn: 28 }))
    expect(turned.gx).toBeCloseTo(-Math.sin((28 * Math.PI) / 180))
    expect(turned.gy).toBeCloseTo(0)
    // rotateX(+): points above the focus (dy < 0) go back.
    const tilted = depthGradient(pose({ tilt: 20 }))
    expect(tilted.gx).toBeCloseTo(0)
    expect(tilted.gy).toBeCloseTo(Math.sin((20 * Math.PI) / 180))
  })

  it("is sharp at the focus point and on a frame facing the camera", () => {
    const base = { ...stage, fStop: 2 }
    expect(
      depthBlurAt({ ...base, pose: pose({ turn: 30 }), dx: 0, dy: 0 })
    ).toBe(0)
    expect(
      depthBlurAt({ ...base, pose: pose({ zoom: 2 }), dx: 800, dy: 400 })
    ).toBe(0)
    expect(
      depthOfFieldLayers({
        ...stage,
        pose: pose({ roll: 15, zoom: 1.5 }),
        frameWidth: 1800,
        frameHeight: 1012,
        fStop: 1.4,
        maxBlur: 3,
      })
    ).toEqual([])
  })

  it("matches the thin lens past the acceptable circle of confusion", () => {
    const turned = pose({ turn: 28 })
    const at = (dx: number, fStop = 2) =>
      depthBlurAt({ ...stage, pose: turned, dx, dy: 0, fStop })
    const coc = (dx: number, fStop = 2) =>
      (apertureFor(fStop, 1920) * Math.sin((28 * Math.PI) / 180) * dx) / 2688
    const sharp = acceptableCoc(1920)
    expect(at(900)).toBeCloseTo((coc(900) - sharp) * 0.42, 6)
    expect(at(-900)).toBeCloseTo(at(900)) // in front or behind, the same
    // Past the sharp zone blur grows linearly with distance…
    expect(at(600) - at(300)).toBeCloseTo(coc(300) * 0.42, 6)
    // …and a band around the focus plane stays perfectly sharp.
    const edgeOfZone = (sharp * 2688) / (apertureFor(2, 1920) * Math.sin((28 * Math.PI) / 180))
    expect(at(edgeOfZone * 0.9)).toBe(0)
    expect(at(edgeOfZone * 1.2)).toBeGreaterThan(0)
    // Wider aperture (smaller f-number), more blur and a thinner zone.
    expect(at(900, 1.4)).toBeGreaterThan(2 * at(900, 2.8))
    // Zooming in (a longer lens) narrows the sharp zone.
    const zoomed = depthBlurAt({
      ...stage,
      pose: pose({ turn: 28, zoom: 2 }),
      dx: 900,
      dy: 0,
      fStop: 2,
    })
    expect(zoomed).toBeGreaterThan(at(900))
    expect(zoomed).toBeCloseTo((coc(900) - sharp / 2) * 0.42, 6)
  })
})

describe("depth of field layers", () => {
  const input = {
    ...stage,
    pose: pose({ turn: 28, focusX: 0.5, focusY: 0.5 }),
    frameWidth: 1800,
    frameHeight: 1012,
    fStop: 1.4,
    maxBlur: 3,
  }

  it("stacks to the exact blur at each band (Gaussians add in quadrature)", () => {
    const layers = depthOfFieldLayers(input)
    expect(layers).toHaveLength(6)
    const edge = depthBlurAt({ ...input, dx: 900, dy: 0 })
    const total = Math.sqrt(layers.reduce((sum, l) => sum + l.blurPx ** 2, 0))
    expect(total).toBeCloseTo(edge, 2) // the far edge, under the cap
    // Horizontal depth: the mask runs across (≈ ±90°) from the focus line.
    expect(layers[0]!.mask).toMatch(/^linear-gradient\((-?90\.00|270\.00)deg/)
  })

  it("keeps the sharp zone clear: the first band starts where blur does", () => {
    const [first] = depthOfFieldLayers(input)
    // Blur starts at d₀ = acceptable CoC / CoC-per-px either side of focus.
    const perPx =
      (apertureFor(1.4, 1920) * Math.sin((28 * Math.PI) / 180)) / 2688
    const d0 = acceptableCoc(1920) / perPx
    const stops = [...first!.mask.matchAll(/transparent (-?[\d.]+)px/g)].map(
      (m) => Number(m[1])
    )
    expect(stops).toHaveLength(2)
    expect(stops[1]! - stops[0]!).toBeCloseTo(2 * d0, 0)
  })

  it("never blurs more than the cap", () => {
    const capped = depthOfFieldLayers({ ...input, maxBlur: 0.2 })
    const total = Math.sqrt(capped.reduce((sum, l) => sum + l.blurPx ** 2, 0))
    expect(total).toBeCloseTo((0.2 / 100) * 1920, 2)
  })
})

describe("progressive blur", () => {
  it("rises to the strength at the edge, clear past its reach", () => {
    const layers = progressiveBlurLayers({
      from: "bottom",
      strength: 1,
      reach: 0.3,
      width: 1800,
      height: 1000,
      stageWidth: 1920,
    })
    const total = Math.sqrt(layers.reduce((sum, l) => sum + l.blurPx ** 2, 0))
    expect(total).toBeCloseTo(19.2, 2)
    // The first layer starts 30% in from the bottom edge.
    expect(layers[0]!.mask).toBe(
      "linear-gradient(180deg, transparent 70.00%, #000 75.00%)"
    )
    expect(layers.at(-1)!.mask).toContain("#000 100.00%")
  })

  it("can blur both edges or all around", () => {
    const both = progressiveBlurLayers({
      from: "both",
      strength: 1,
      reach: 0.2,
      width: 100,
      height: 100,
      stageWidth: 1920,
    })
    expect(both[0]!.mask).toContain("transparent 20.00%")
    expect(both[0]!.mask).toContain("transparent 80.00%")
    const edges = progressiveBlurLayers({
      from: "edges",
      strength: 1,
      reach: 0.4,
      width: 100,
      height: 100,
      stageWidth: 1920,
    })
    expect(edges[0]!.mask).toMatch(
      /^radial-gradient\(closest-side, transparent 60\.00%/
    )
  })
})

describe("lens settings", () => {
  it("default to off, and validate f-stops", () => {
    expect(defaultLens.depthOfField.enabled).toBe(false)
    expect(defaultLens.progressiveBlur.enabled).toBe(false)
    expect(
      lensSchema.safeParse({
        depthOfField: { enabled: true, fStop: 3, maxBlur: 1 },
      }).success
    ).toBe(false)
  })
})
