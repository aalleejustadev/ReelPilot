import { describe, expect, it } from "vitest"

import {
  clipEditSchema,
  emptyEdit,
  joinWithPrevious,
  outputDuration,
  outputLayout,
  partsOf,
  splitAt,
  toOutput,
  toOutputNearest,
  toSource,
  updatePart,
  updateRange,
  type ClipEdit,
} from "../edit"

const D = 10_000
const push = {
  kind: "push" as const,
  durationMs: 500,
  direction: "left" as const,
}

describe("clip edits", () => {
  it("is the whole clip when nothing is edited", () => {
    expect(partsOf(emptyEdit, D)).toEqual([
      expect.objectContaining({
        startMs: 0,
        endMs: D,
        speed: 1,
        removed: false,
      }),
    ])
    expect(outputDuration(emptyEdit, D)).toBe(D)
    expect(toSource(emptyEdit, D, 4200)).toBe(4200)
    expect(toOutput(emptyEdit, D, 4200)).toBe(4200)
  })

  it("splits into parts that inherit settings, not the transition", () => {
    let edit = updatePart(splitAt(emptyEdit, D, 4000), 0, { speed: 2 })
    edit = splitAt(edit, D, 2000)
    expect(edit.parts.map((p) => [p.startMs, p.speed])).toEqual([
      [0, 2],
      [2000, 2],
      [4000, 1],
    ])
    // Too close to an edge: no tiny parts.
    expect(splitAt(edit, D, 2100)).toBe(edit)
    expect(splitAt(edit, D, D - 50)).toBe(edit)
  })

  it("removes parts from the ad and maps times around them", () => {
    const edit = updatePart(splitAt(splitAt(emptyEdit, D, 2000), D, 5000), 1, {
      removed: true,
    })
    expect(outputDuration(edit, D)).toBe(7000)
    expect(toOutput(edit, D, 1000)).toBe(1000)
    expect(toOutput(edit, D, 3000)).toBeNull() // cut
    expect(toOutputNearest(edit, D, 3000)).toBe(2000) // the next kept part
    expect(toOutput(edit, D, 6000)).toBe(3000)
    expect(toSource(edit, D, 3000)).toBe(6000)
  })

  it("plays sped-up parts faster", () => {
    const edit = updateRange(emptyEdit, D, 2000, 6000, { speed: 4 })
    expect(edit.parts.map((p) => [p.startMs, p.speed])).toEqual([
      [0, 1],
      [2000, 4],
      [6000, 1],
    ])
    expect(outputDuration(edit, D)).toBe(2000 + 1000 + 4000)
    expect(toOutput(edit, D, 4000)).toBe(2500)
    expect(toSource(edit, D, 2500)).toBe(4000)
  })

  it("overlaps parts by their transition, fitted to both parts", () => {
    const edit = updatePart(splitAt(emptyEdit, D, 5000), 1, {
      transition: push,
    })
    const [first, second] = outputLayout(edit, D)
    expect(second).toMatchObject({ outStartMs: 4500, inMs: 500 })
    expect(outputDuration(edit, D)).toBe(9500)
    // Before the transition's midpoint it's still the outgoing part.
    expect(toSource(edit, D, 4600)).toBe(4600)
    expect(toSource(edit, D, 4800)).toBe(5300)
    expect(first?.inMs).toBe(0)
    // A transition longer than half a short part is shortened.
    const tight = updatePart(splitAt(emptyEdit, D, 9600), 1, {
      transition: { ...push, durationMs: 1500 },
    })
    expect(outputLayout(tight, D)[1]?.inMs).toBe(200)
  })

  it("joins a part with the one before, back to a plain clip", () => {
    const edit = splitAt(emptyEdit, D, 5000)
    expect(joinWithPrevious(edit, 1)).toEqual(emptyEdit)
    const fast = updatePart(edit, 0, { speed: 2 })
    expect(joinWithPrevious(fast, 1).parts).toHaveLength(1)
  })

  it("never removes the whole clip", () => {
    const edit = splitAt(emptyEdit, D, 5000)
    const one = updatePart(edit, 0, { removed: true })
    expect(updatePart(one, 1, { removed: true })).toBe(one)
    expect(updateRange(emptyEdit, D, 0, D, { removed: true })).toBe(emptyEdit)
  })

  it("validates stored edits", () => {
    const good: ClipEdit = splitAt(emptyEdit, D, 5000)
    expect(clipEditSchema.parse(good)).toEqual(good)
    expect(
      clipEditSchema.safeParse({ parts: [{ startMs: 100 }] }).success
    ).toBe(false)
    expect(
      clipEditSchema.safeParse({
        parts: [{ startMs: 0 }, { startMs: 0 }],
      }).success
    ).toBe(false)
    expect(
      clipEditSchema.safeParse({ parts: [{ startMs: 0, speed: 3 }] }).success
    ).toBe(false)
  })
})
