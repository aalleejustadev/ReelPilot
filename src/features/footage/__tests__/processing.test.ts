import { describe, expect, it } from "vitest"

import {
  parseSceneLog,
  pickAutoMarkers,
  processingRules,
  thumbnailPlan,
} from "../lib/processing"

describe("thumbnailPlan", () => {
  it("uses one thumbnail per second for short clips", () => {
    expect(thumbnailPlan(12_000)).toEqual({ count: 12, intervalMs: 1000 })
  })

  it("never makes more than the maximum for long clips", () => {
    const plan = thumbnailPlan(10 * 60 * 1000)
    expect(plan.count).toBeLessThanOrEqual(processingRules.maxThumbnails)
    expect(plan.count * plan.intervalMs).toBeGreaterThanOrEqual(10 * 60 * 1000)
  })

  it("makes at least one for a tiny clip", () => {
    expect(thumbnailPlan(300)).toEqual({ count: 1, intervalMs: 1000 })
  })
})

describe("parseSceneLog", () => {
  it("pairs each frame time with its scene score", () => {
    const log = [
      "[Parsed_metadata_2 @ 0x1] frame:0    pts:36      pts_time:1.2",
      "[Parsed_metadata_2 @ 0x1] lavfi.scene_score=0.512",
      "frame=  100 fps=0.0 q=-0.0 size=N/A time=00:00:04.00",
      "[Parsed_metadata_2 @ 0x1] frame:1    pts:150     pts_time:5",
      "[Parsed_metadata_2 @ 0x1] lavfi.scene_score=0.9",
    ].join("\n")

    expect(parseSceneLog(log)).toEqual([
      { atMs: 1200, score: 0.512 },
      { atMs: 5000, score: 0.9 },
    ])
  })

  it("returns nothing for a log without scene changes", () => {
    expect(parseSceneLog("frame=  10 fps=0.0")).toEqual([])
  })
})

describe("pickAutoMarkers", () => {
  it("keeps the strongest changes, spaced apart, in time order", () => {
    const scenes = [
      { atMs: 3000, score: 0.4 },
      { atMs: 3500, score: 0.9 }, // beats 3000 (too close)
      { atMs: 8000, score: 0.5 },
      { atMs: 200, score: 1 }, // too close to the start
    ]

    expect(pickAutoMarkers(scenes, 20_000)).toEqual([3500, 8000])
  })

  it("caps the number of markers", () => {
    const scenes = Array.from({ length: 100 }, (_, i) => ({
      atMs: 1000 + i * 3000,
      score: 0.5,
    }))

    expect(pickAutoMarkers(scenes, 400_000)).toHaveLength(
      processingRules.maxAutoMarkers
    )
  })

  it("spaces moments evenly when the clip has no clear changes", () => {
    expect(pickAutoMarkers([], 20_000)).toEqual([5000, 10_000, 15_000])
  })

  it("leaves very short static clips without markers", () => {
    expect(pickAutoMarkers([], 3000)).toEqual([])
  })
})
