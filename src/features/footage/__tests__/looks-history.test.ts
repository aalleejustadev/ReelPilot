import { describe, expect, it } from "vitest"

import {
  defaultPresentation,
  shotPresets,
  shotSchema,
  type Shot,
} from "@/shared/motion"

import type { Aim } from "../lib/aim"

import { commit, createHistory, redo, undo } from "../lib/history"
import { applyLook, backgroundPresets, looks, resetLook } from "../lib/looks"

const moments = [
  { id: "c", atMs: 9000 },
  { id: "a", atMs: 1000 },
  { id: "b", atMs: 5000 },
]

/** `count` moments 3s apart, optionally with an aim each. */
const many = (count: number, aim?: (i: number) => Aim | null) =>
  Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    atMs: 1000 + i * 3000,
    aim: aim?.(i) ?? null,
  }))

const aim = (focusX: number, focusY: number, zoom = 2): Aim => ({
  focusX,
  focusY,
  zoom,
  box: null,
  source: "activity",
})

const blank = { shots: {}, presentation: defaultPresentation }
const inOrder = (shots: Record<string, Shot | null>, count: number) =>
  Array.from({ length: count }, (_, i) => shots[`m${i}`]!)
const same = (a: Shot, b: Shot) =>
  JSON.stringify(a.camera) === JSON.stringify(b.camera)

describe("looks", () => {
  it("never repeats a move back to back, and varies within two", () => {
    for (const id of ["launch", "hype", "isometric", "dolly"]) {
      const shots = inOrder(applyLook(id, many(12), blank).shots, 12)
      shots.forEach((shot, i) => {
        if (i > 0) expect(same(shot, shots[i - 1]!), `${id} #${i}`).toBe(false)
      })
    }
  })

  it("turns the other way instead of the same way over and over", () => {
    const shots = inOrder(applyLook("hype", many(12), blank).shots, 12)
    const signs = shots
      .map((shot) => Math.sign(Math.round(shot.camera.turn)))
      .filter((sign) => sign !== 0)
    for (let i = 2; i < signs.length; i++) {
      expect(signs[i] === signs[i - 1] && signs[i] === signs[i - 2]).toBe(false)
    }
  })

  it("opens, lands the hero shot on the strongest moment, then closes", () => {
    // The action at m3 is the most focused (2.2×).
    const moments = many(6, (i) =>
      i === 3 ? aim(0.8, 0.2, 2.2) : aim(0.3, 0.5, 1.3)
    )
    const { shots, presentation } = applyLook("launch", moments, blank)
    expect(shots.m0?.camera).toEqual(shotPresets["hero-rise"].camera)
    expect(shots.m3?.camera).toMatchObject({
      tilt: shotPresets.spotlight.camera.tilt,
      focusX: 0.8,
      focusY: 0.2,
      zoom: 2.3, // the preset's own zoom is deeper than the aim
    })
    expect(shots.m5?.camera).toEqual(shotPresets["tilted-card"].camera)
    expect(presentation.intro).toEqual({ kind: "rise", durationMs: 1400 })
    expect(presentation.frame).toMatchObject({ padding: 0.1, radius: 3 })
  })

  it("aims at the action: fully on flat shots, gently on angled ones", () => {
    const { shots } = applyLook(
      "tour",
      many(4, () => aim(0.7, 0.3, 2)),
      blank
    )
    // Tour: flat zooms right to where things happen.
    expect(shots.m1?.camera).toMatchObject({
      tilt: 0,
      turn: 0,
      focusX: 0.7,
      zoom: 2,
    })
    const hype = inOrder(
      applyLook(
        "hype",
        many(8, () => aim(0.7, 0.3, 2)),
        blank
      ).shots,
      8
    )
    for (const shot of hype) {
      const angled =
        Math.abs(shot.camera.turn) > 1 || Math.abs(shot.camera.roll) > 1
      // Angled shots stay readable: no deeper than 1.45× from aiming alone.
      if (angled) expect(shot.camera.zoom).toBeLessThanOrEqual(1.45)
    }
  })

  it("pans between nearby moments instead of zooming out and in", () => {
    const { shots } = applyLook(
      "tour",
      [
        { id: "a", atMs: 0 }, // the opener: wide
        { id: "b", atMs: 3000, aim: aim(0.2, 0.2, 1.8) },
        { id: "c", atMs: 6000, aim: aim(0.3, 0.25, 1.6) }, // close to b
        { id: "d", atMs: 9000, aim: aim(0.8, 0.8, 2.2) }, // the hero
        { id: "e", atMs: 12000 },
      ],
      blank
    )
    // c keeps b's zoom and just glides over: a short move.
    expect(shots.c?.camera).toMatchObject({ zoom: 1.8, focusX: 0.3 })
    expect(shots.c?.transitionMs).toBeLessThan(1000)
    expect(shots.b?.transitionMs).toBeGreaterThan(shots.c!.transitionMs)
  })

  it("takes longer for bigger moves, but never longer than the gap", () => {
    const deep = (gapMs: number) =>
      applyLook(
        "tour",
        [
          { id: "a", atMs: 0 },
          { id: "b", atMs: gapMs, aim: aim(0.9, 0.9, 2.2) },
        ],
        blank
      ).shots.b!.transitionMs
    expect(deep(5000)).toBeGreaterThan(1000) // a deep, calm zoom
    expect(deep(600)).toBeLessThanOrEqual(480) // 80% of the 600ms gap
  })

  it("cuts instead of moving in the editorial look", () => {
    const shots = inOrder(applyLook("editorial", many(5), blank).shots, 5)
    expect(shots.every((shot) => shot.transitionMs === 0)).toBe(true)
  })

  it("gives the same cut every time, and a different one per take", () => {
    const input = many(8)
    const first = applyLook("launch", input, blank)
    expect(applyLook("launch", input, blank)).toEqual(first)
    expect(applyLook("launch", input, blank, { take: 1 }).shots).not.toEqual(
      first.shots
    )
  })

  it("gives every look a visibly different new take", () => {
    const input = many(6, (i) => aim(0.2 + i * 0.1, 0.4, 1.8))
    for (const look of looks) {
      const takes = [0, 1, 2].map((take) =>
        JSON.stringify(applyLook(look.id, input, blank, { take }).shots)
      )
      expect(new Set(takes).size, look.id).toBe(3)
    }
  })

  it("keeps a focus point the owner picked", () => {
    const { shots } = applyLook("tour", moments, {
      shots: {
        a: {
          camera: { ...shotPresets.flat.camera, focusX: 0.9, focusY: 0.1 },
          transitionMs: 800,
          easing: "smooth",
          drift: 0,
        },
      },
      presentation: defaultPresentation,
    })
    expect(shots.a?.camera).toMatchObject({ focusX: 0.9, focusY: 0.1 })
    expect(shots.b?.camera).toMatchObject({ focusX: 0.5, focusY: 0.5 })
  })

  it("drifts more on long holds", () => {
    const { shots } = applyLook(
      "dolly",
      [
        { id: "a", atMs: 0 },
        { id: "b", atMs: 1000 },
        { id: "c", atMs: 9000 },
        { id: "d", atMs: 12000 },
      ],
      blank
    )
    expect(shots.b!.drift).toBeGreaterThan(shots.a!.drift)
  })

  it("resets to flat with no intro", () => {
    const { shots, presentation } = resetLook(moments, {
      ...defaultPresentation,
      intro: { kind: "rise", durationMs: 900 },
    })
    expect(Object.values(shots)).toEqual([null, null, null])
    expect(presentation.intro.kind).toBe("none")
  })

  it("every look produces valid shots, with and without aims", () => {
    for (const look of looks) {
      for (const input of [moments, many(9, (i) => aim(i / 9, 0.5, 1.8))]) {
        const { shots } = applyLook(look.id, input, blank)
        for (const shot of Object.values(shots)) {
          expect(() => shotSchema.parse(shot)).not.toThrow()
        }
      }
    }
  })

  it("puts the brand's colours first among backgrounds", () => {
    expect(backgroundPresets(["#ff5a1f", "#2f6bff"])[0]).toEqual({
      name: "Brand",
      background: { kind: "gradient", from: "#ff5a1f", to: "#2f6bff" },
    })
    expect(backgroundPresets([])[0]?.name).toBe("Midnight")
  })
})

describe("history", () => {
  it("undoes and redoes changes", () => {
    let h = createHistory(1)
    h = commit(h, 2, { now: 0 })
    h = commit(h, 3, { now: 5000 })

    h = undo(h)
    expect(h.present).toBe(2)
    h = undo(h)
    expect(h.present).toBe(1)
    expect(undo(h)).toBe(h) // nothing left
    h = redo(h)
    expect(h.present).toBe(2)
  })

  it("merges quick changes to the same control into one step", () => {
    let h = createHistory(0)
    h = commit(h, 1, { coalesceKey: "zoom", now: 0 })
    h = commit(h, 2, { coalesceKey: "zoom", now: 100 })
    h = commit(h, 3, { coalesceKey: "zoom", now: 200 })

    expect(undo(h).present).toBe(0)
  })

  it("keeps separate steps for different controls or pauses", () => {
    let h = createHistory(0)
    h = commit(h, 1, { coalesceKey: "zoom", now: 0 })
    h = commit(h, 2, { coalesceKey: "tilt", now: 100 })
    h = commit(h, 3, { coalesceKey: "tilt", now: 2000 })

    expect(undo(h).present).toBe(2)
  })

  it("drops redo steps after a new change", () => {
    let h = createHistory(0)
    h = commit(h, 1, { now: 0 })
    h = undo(h)
    h = commit(h, 5, { now: 5000 })
    expect(redo(h)).toBe(h)
  })
})
