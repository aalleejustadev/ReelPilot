import { z } from "zod"

/**
 * What the in-app recorder learned besides the video (§7.4b). A web page
 * can't see clicks or keys in another tab; it can know what was shared
 * (a tab, a window or the whole screen) and, in browsers that support
 * Captured Mouse Events, where the cursor was.
 */
export const recordingLimits = {
  /** 20 samples a second for 10 minutes. */
  cursorSamples: 12_000,
  cursorEveryMs: 50,
} as const

const unit = z.number().min(0).max(1)

export const recordingSchema = z.object({
  version: z.literal(1),
  surface: z.enum(["browser", "window", "monitor", "unknown"]),
  /** [msFromStart, x, y] in 0–1 of the shared surface. */
  cursor: z
    .array(z.tuple([z.number().int().min(0), unit, unit]))
    .max(recordingLimits.cursorSamples),
})
export type RecordingInfo = z.infer<typeof recordingSchema>

export function parseStoredRecording(value: unknown): RecordingInfo | null {
  const parsed = recordingSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Where the cursor mostly was from `atMs` over the next 1.5 seconds (the
 * median, so one flick across the screen doesn't count). Null without a
 * cursor track or samples in that window.
 */
export function cursorAt(recording: RecordingInfo | null, atMs: number) {
  const samples = (recording?.cursor ?? []).filter(
    ([t]) => t >= atMs - 200 && t <= atMs + 1500
  )
  if (samples.length === 0) return null
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]!
  }
  return {
    x: median(samples.map(([, x]) => x)),
    y: median(samples.map(([, , y]) => y)),
  }
}
