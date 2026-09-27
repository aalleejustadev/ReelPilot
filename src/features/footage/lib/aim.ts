import { actionAt, type Box, type FootageAnalysis } from "./analysis"
import type { MomentInsight } from "./insight"
import { cursorAt, type RecordingInfo } from "./recording"

export type Aim = {
  focusX: number
  focusY: number
  zoom: number
  /** The area aimed at, when known (for highlighting it). */
  box: Box | null
  /** What found it: the screen changing, the AI, or the cursor. */
  source: "activity" | "ai" | "cursor"
}

/** Aims that barely zoom aren't worth offering. */
const minAimZoom = 1.2

const round3 = (n: number) => Math.round(n * 1000) / 1000

function boxAim(box: Box, source: Aim["source"]): Aim {
  const zoom = Math.min(2.2, Math.max(1, 0.6 / Math.max(box.w, box.h)))
  return {
    focusX: round3(box.x + box.w / 2),
    focusY: round3(box.y + box.h / 2),
    zoom: Math.round(zoom * 20) / 20,
    box,
    source,
  }
}

/**
 * Where the camera should look at a moment. What actually changes on
 * screen comes first (measured, so it's where the eye goes); then the
 * element the AI picked; then the cursor. Null when nothing is known.
 */
export function aimAt(input: {
  analysis: FootageAnalysis | null
  insight: MomentInsight | null
  recording: RecordingInfo | null
  atMs: number
}): Aim | null {
  const action = input.analysis ? actionAt(input.analysis, input.atMs) : null
  // A change spread over half the screen isn't a place to zoom into.
  if (action && action.zoom >= minAimZoom) {
    return { ...action, source: "activity" }
  }
  const ai = input.insight?.focus ? boxAim(input.insight.focus, "ai") : null
  if (ai && ai.zoom >= minAimZoom) return ai
  const cursor = cursorAt(input.recording, input.atMs)
  if (cursor) {
    return {
      focusX: cursor.x,
      focusY: cursor.y,
      zoom: 1.6,
      box: null,
      source: "cursor",
    }
  }
  return null
}
