import { describe, expect, it } from "vitest"

import { defaultPresentation, shotPresets } from "@/shared/motion"

import { commit, createHistory, redo, undo } from "../lib/history"
import { applyLook, backgroundPresets, looks, resetLook } from "../lib/looks"

const moments = [
  { id: "c", atMs: 9000 },
  { id: "a", atMs: 1000 },
  { id: "b", atMs: 5000 },
]

describe("looks", () => {
  it("cycles the look's shots across moments in time order", () => {
    const { shots, presentation } = applyLook("showcase", moments, {
      shots: {},
      presentation: defaultPresentation,
    })

    expect(shots.a?.camera).toEqual(shotPresets["orbit-left"].camera)
    expect(shots.b?.camera).toEqual(shotPresets["orbit-right"].camera)
    expect(shots.c?.camera).toEqual(shotPresets["orbit-left"].camera)
    expect(shots.a).toMatchObject({ transitionMs: 1200, drift: 0.5 })
    expect(presentation.intro.kind).toBe("zoom-out")
  })

  it("keeps a focus point the owner picked", () => {
    const { shots } = applyLook("feature-zoom", moments, {
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

    expect(shots.a?.camera).toMatchObject({
      zoom: 1.8,
      focusX: 0.9,
      focusY: 0.1,
    })
    expect(shots.b?.camera).toMatchObject({ focusX: 0.5, focusY: 0.5 })
  })

  it("resets to flat with no intro", () => {
    const { shots, presentation } = resetLook(moments, {
      ...defaultPresentation,
      intro: { kind: "rise", durationMs: 900 },
    })
    expect(Object.values(shots)).toEqual([null, null, null])
    expect(presentation.intro.kind).toBe("none")
  })

  it("every look produces valid shots", () => {
    for (const look of looks) {
      expect(() =>
        applyLook(look.id, moments, {
          shots: {},
          presentation: defaultPresentation,
        })
      ).not.toThrow()
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
