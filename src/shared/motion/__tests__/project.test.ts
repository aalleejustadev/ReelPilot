import { describe, expect, it } from "vitest"

import {
  clipAt,
  defaultClipTransition,
  projectClipSchema,
  projectLayout,
} from "../project"

const cut = defaultClipTransition
const blur = {
  kind: "blur" as const,
  durationMs: 500,
  direction: "left" as const,
}

describe("project layout", () => {
  it("plays clips back to back with cuts", () => {
    const { slots, durationMs } = projectLayout([
      { lengthMs: 3000, transition: cut },
      { lengthMs: 2000, transition: cut },
    ])
    expect(slots).toEqual([
      { startMs: 0, endMs: 3000, inMs: 0 },
      { startMs: 3000, endMs: 5000, inMs: 0 },
    ])
    expect(durationMs).toBe(5000)
  })

  it("overlaps a clip with the one before by its transition", () => {
    const { slots, durationMs } = projectLayout([
      { lengthMs: 3000, transition: cut },
      { lengthMs: 2000, transition: blur },
    ])
    expect(slots[1]).toEqual({ startMs: 2500, endMs: 4500, inMs: 500 })
    expect(durationMs).toBe(4500)
  })

  it("fits a transition to half of either clip", () => {
    const { slots } = projectLayout([
      { lengthMs: 600, transition: cut },
      { lengthMs: 5000, transition: { ...blur, durationMs: 1500 } },
    ])
    expect(slots[1]!.inMs).toBe(300)
  })

  it("ignores the first clip's transition, and is empty with no clips", () => {
    expect(
      projectLayout([{ lengthMs: 1000, transition: blur }]).slots[0]
    ).toEqual({ startMs: 0, endMs: 1000, inMs: 0 })
    expect(projectLayout([])).toEqual({ slots: [], durationMs: 0 })
  })

  it("finds the clip showing (the incoming one in a transition)", () => {
    const { slots } = projectLayout([
      { lengthMs: 3000, transition: cut },
      { lengthMs: 2000, transition: blur },
      { lengthMs: 2000, transition: cut },
    ])
    expect(clipAt(slots, 0)).toBe(0)
    expect(clipAt(slots, 2499)).toBe(0)
    expect(clipAt(slots, 2600)).toBe(1)
    expect(clipAt(slots, 4600)).toBe(2)
  })

  it("validates a clip entry", () => {
    expect(
      projectClipSchema.safeParse({ footageId: "f1", transition: blur }).success
    ).toBe(true)
    expect(
      projectClipSchema.safeParse({
        footageId: "f1",
        transition: { kind: "spin", durationMs: 1 },
      }).success
    ).toBe(false)
  })
})
