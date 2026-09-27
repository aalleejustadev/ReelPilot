import { describe, expect, it } from "vitest"

import {
  backgroundStyle,
  cameraStyle,
  cameraTimeline,
  flatCamera,
  presentationSchema,
  shotPresets,
  shotSchema,
  type Shot,
} from "../index"

const noIntro = { kind: "none" as const, durationMs: 1000 }
const shot = (overrides: Partial<Shot> = {}): Shot => ({
  camera: shotPresets["tilt-left"].camera,
  transitionMs: 1000,
  easing: "linear",
  drift: 0,
  ...overrides,
})

describe("cameraTimeline", () => {
  it("is flat when there are no shots", () => {
    const at = cameraTimeline([], noIntro)
    expect(at(0)).toMatchObject({ ...flatCamera, x: 0, y: 0 })
    expect(at(99_000)).toMatchObject(flatCamera)
  })

  it("enters from the intro pose and lands flat", () => {
    const at = cameraTimeline([], { kind: "fly-left", durationMs: 1000 })
    expect(at(0)).toMatchObject({ x: -1.1, turn: 55 })
    expect(at(500).x).toBeGreaterThan(-1.1)
    expect(at(500).x).toBeLessThan(0)
    expect(at(1000)).toMatchObject({ ...flatCamera, x: 0 })
  })

  it("holds flat until a shot, moves into it, then holds it", () => {
    const at = cameraTimeline([{ atMs: 2000, shot: shot() }], noIntro)
    expect(at(1999).turn).toBe(0)
    expect(at(2500).turn).toBeCloseTo(14) // halfway, linear
    expect(at(3000).turn).toBeCloseTo(28)
    expect(at(10_000).turn).toBeCloseTo(28)
  })

  it("starts the next move from wherever the camera is, even mid-move", () => {
    const at = cameraTimeline(
      [
        { atMs: 0, shot: shot({ camera: { ...flatCamera, zoom: 3 } }) },
        { atMs: 500, shot: shot({ camera: flatCamera }) }, // zoom was 2 here
      ],
      noIntro
    )
    expect(at(500).zoom).toBeCloseTo(2) // no jump when the second move starts
    expect(at(1000).zoom).toBeCloseTo(1.5)
    expect(at(1500).zoom).toBeCloseTo(1)
  })

  it("orders shots by time, whatever order they come in", () => {
    const a = { atMs: 4000, shot: shot({ camera: flatCamera }) }
    const b = { atMs: 1000, shot: shot() }
    expect(cameraTimeline([a, b], noIntro)(3000).turn).toBeCloseTo(28)
  })

  it("cuts instantly when a shot has no transition", () => {
    const at = cameraTimeline(
      [{ atMs: 1000, shot: shot({ transitionMs: 0 }) }],
      noIntro
    )
    expect(at(1000).turn).toBeCloseTo(28)
  })

  it("eases smoothly: slow at the ends, fast in the middle", () => {
    const at = cameraTimeline(
      [{ atMs: 0, shot: shot({ easing: "smooth" }) }],
      noIntro
    )
    expect(at(100).turn).toBeLessThan(28 * 0.1)
    expect(at(500).turn).toBeCloseTo(14)
  })
})

describe("styles", () => {
  it("builds a CSS 3D transform pivoting on the focus point", () => {
    expect(
      cameraStyle({
        ...flatCamera,
        tilt: 10,
        turn: -20,
        zoom: 1.5,
        focusX: 0.25,
        x: 0,
        y: 0,
      })
    ).toEqual({
      transform:
        "translate(0%, 0%) rotateX(10deg) rotateY(-20deg) rotateZ(0deg) scale(1.5)",
      transformOrigin: "25% 50%",
    })
  })

  it("gives the frame round corners, not stretched ones", async () => {
    const { frameRadiusCss } = await import("../timeline")
    // One length for both directions (container units), never a bare %.
    expect(frameRadiusCss(2)).toBe("2cqw")
    expect(frameRadiusCss(3.456)).toBe("3.46cqw")
  })

  it("draws solid and gradient backgrounds", () => {
    expect(
      backgroundStyle({ kind: "solid", from: "#111111", to: "#222222" })
    ).toBe("#111111")
    expect(
      backgroundStyle({ kind: "gradient", from: "#111111", to: "#222222" })
    ).toBe("linear-gradient(135deg, #111111, #222222)")
  })
})

describe("schemas", () => {
  it("keeps cameras within their limits", () => {
    expect(
      shotSchema.safeParse(shot({ camera: { ...flatCamera, turn: 90 } }))
        .success
    ).toBe(false)
    expect(shotSchema.safeParse(shot()).success).toBe(true)
  })

  it("accepts every preset", () => {
    for (const { camera } of Object.values(shotPresets)) {
      expect(shotSchema.safeParse(shot({ camera })).success).toBe(true)
    }
  })

  it("normalizes background colours", () => {
    const parsed = presentationSchema.parse({
      background: { kind: "solid", from: "#FF5A1F", to: "#000000" },
      frame: { radius: 2, shadow: true, padding: 0.1 },
      intro: { kind: "rise", durationMs: 1000 },
    })
    expect(parsed.background.from).toBe("#ff5a1f")
  })
})

describe("drift", () => {
  it("keeps pushing in while a shot holds, until the next shot", () => {
    const at = cameraTimeline(
      [
        {
          atMs: 0,
          shot: shot({ camera: flatCamera, transitionMs: 0, drift: 1 }),
        },
        { atMs: 10_000, shot: shot({ camera: flatCamera, transitionMs: 0 }) },
      ],
      noIntro
    )
    expect(at(0).zoom).toBeCloseTo(1)
    expect(at(5000).zoom).toBeCloseTo(1.05)
    expect(at(9999).zoom).toBeCloseTo(1.1, 2)
    expect(at(10_000).zoom).toBeCloseTo(1) // the next shot takes over
  })

  it("drifts the last shot until the clip ends", () => {
    const at = cameraTimeline(
      [
        {
          atMs: 0,
          shot: shot({ camera: flatCamera, transitionMs: 0, drift: 0.5 }),
        },
      ],
      noIntro,
      4000
    )
    expect(at(4000).zoom).toBeCloseTo(1.05)
  })

  it("reads old shots without drift as still", () => {
    const { drift: _drift, ...old } = shot()
    expect(shotSchema.parse(old).drift).toBe(0)
  })
})

describe("presets", () => {
  it("offers 18 shots, each in exactly one group", async () => {
    const { shotPresetGroups, shotPresetNames } = await import("../index")
    const grouped = shotPresetGroups.flatMap((group) => group.presets)
    expect(shotPresetNames).toHaveLength(18)
    expect([...grouped].sort()).toEqual([...shotPresetNames].sort())
  })
})

describe("shotLabel", () => {
  it("names presets, aimed zooms and hand-tuned shots", async () => {
    const { shotLabel } = await import("../index")
    const flat = shotPresets.flat.camera
    expect(shotLabel(shotPresets["tilt-left"].camera)).toBe("Tilt left")
    // Aimed closer (e.g. "Aim at the action"): named for what it is.
    expect(shotLabel({ ...flat, zoom: 1.8, focusX: 0.8 })).toBe("Zoom 1.8×")
    expect(shotLabel({ ...flat, focusX: 0.8 })).toBe("Flat")
    expect(
      shotLabel({ ...shotPresets["tilt-left"].camera, zoom: 2.2, focusY: 0.1 })
    ).toBe("Tilt left · 2.2×")
    expect(shotLabel({ ...shotPresets["tilt-left"].camera, turn: 5 })).toBe(
      "Custom"
    )
  })
})
