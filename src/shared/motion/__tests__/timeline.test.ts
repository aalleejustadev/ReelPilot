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
    // Landed (within ~2%) by the intro's length, fully flat soon after.
    expect(Math.abs(at(1000).turn)).toBeLessThan(55 * 0.03)
    expect(at(2000).turn).toBeCloseTo(0, 1)
    expect(at(2000).x).toBeCloseTo(0, 2)
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
    // Zoom moves in log space: halfway from 1× to 3× is √3×, not 2×.
    expect(at(500).zoom).toBeCloseTo(Math.sqrt(3))
    expect(at(499).zoom).toBeCloseTo(at(500).zoom, 2) // no jump
    expect(at(1000).zoom).toBeCloseTo(Math.sqrt(Math.sqrt(3)))
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

  it("moves on a smooth spring: soft start, lands on time, no overshoot", () => {
    const at = cameraTimeline(
      [{ atMs: 0, shot: shot({ easing: "smooth" }) }],
      noIntro
    )
    expect(at(30).turn).toBeLessThan(28 * 0.03) // eases off the mark
    expect(at(1000).turn).toBeGreaterThan(28 * 0.97) // landed
    let previous = 0
    for (let t = 0; t <= 3000; t += 10) {
      const turn = at(t).turn
      expect(turn).toBeGreaterThanOrEqual(previous - 1e-9) // never goes back
      expect(turn).toBeLessThanOrEqual(28 + 1e-9) // never overshoots
      previous = turn
    }
  })

  it("snaps quicker with a snappy spring, overshooting only slightly", () => {
    const timeline = (easing: "smooth" | "snappy") =>
      cameraTimeline([{ atMs: 0, shot: shot({ easing }) }], noIntro)
    const smooth = timeline("smooth")
    const snappy = timeline("snappy")
    expect(snappy(250).turn).toBeGreaterThan(smooth(250).turn)
    const peak = Math.max(
      ...Array.from({ length: 300 }, (_, i) => snappy(i * 10).turn)
    )
    expect(peak).toBeGreaterThan(28)
    expect(peak).toBeLessThan(28 * 1.02)
    expect(snappy(3000).turn).toBeCloseTo(28, 1)
  })

  it("keeps the camera's speed when a new shot interrupts a move", () => {
    const smooth = shot({ easing: "smooth" })
    const at = cameraTimeline(
      [
        { atMs: 0, shot: smooth },
        { atMs: 300, shot: { ...smooth, camera: shotPresets.dramatic.camera } },
      ],
      noIntro
    )
    // Speed just before and just after the second shot starts: the same.
    const before = at(299).turn - at(298).turn
    const after = at(301).turn - at(300).turn
    expect(Math.abs(after - before)).toBeLessThan(0.01)
  })
})

describe("cameraSpeed", () => {
  it("is 0 when still and grows with angle, zoom and pan speed", async () => {
    const { cameraSpeed } = await import("../timeline")
    const still = { ...flatCamera, x: 0, y: 0 }
    expect(cameraSpeed(still, still, 33)).toBe(0)
    expect(cameraSpeed(still, { ...still, turn: 3 }, 33)).toBeCloseTo(
      3 / 0.033 / 90,
      1
    )
    expect(cameraSpeed(still, { ...still, zoom: 1.1 }, 100)).toBeCloseTo(
      Math.log(1.1) * 10
    )
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
  it("offers 21 shots, each in exactly one group", async () => {
    const { shotPresetGroups, shotPresetNames } = await import("../index")
    const grouped = shotPresetGroups.flatMap((group) => group.presets)
    expect(shotPresetNames).toHaveLength(21)
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

  it("names a mirrored shot after the one it mirrors", async () => {
    const { mirrorCamera, shotLabel } = await import("../index")
    expect(shotLabel(mirrorCamera(shotPresets.dramatic.camera))).toBe(
      "Dramatic · mirrored"
    )
    // Mirror pairs are each other's presets.
    expect(shotLabel(mirrorCamera(shotPresets["side-sweep-left"].camera))).toBe(
      "Side sweep right"
    )
  })
})

describe("moveDurationMs", () => {
  it("takes longer for deeper zooms, bigger turns and longer pans", async () => {
    const { moveDurationMs } = await import("../timeline")
    const flat = shotPresets.flat.camera
    const small = moveDurationMs(flat, { ...flat, zoom: 1.25 })
    const deep = moveDurationMs(flat, { ...flat, zoom: 2.5 })
    expect(small).toBe(700) // 0.6s + 0.55s·ln(1.25)
    expect(deep).toBeGreaterThan(small)
    expect(moveDurationMs(flat, shotPresets.dramatic.camera)).toBeGreaterThan(
      small
    )
    expect(
      moveDurationMs(flat, { ...flat, focusX: 0.9, focusY: 0.9 })
    ).toBeGreaterThan(700)
  })

  it("follows the pace and stays within 0.3–2.6s", async () => {
    const { moveDurationMs } = await import("../timeline")
    const flat = shotPresets.flat.camera
    const far = { ...flat, zoom: 3, turn: 60, focusX: 1 }
    expect(moveDurationMs(flat, far, "calm")).toBe(2600)
    expect(moveDurationMs(flat, flat, "brisk")).toBe(350)
    expect(moveDurationMs(flat, flat, "calm")).toBeGreaterThan(
      moveDurationMs(flat, flat)
    )
  })
})
