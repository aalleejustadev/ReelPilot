/** Pure parts of footage processing (the job runs them with ffmpeg). */

export const processingRules = {
  /** Long side of the converted video, in pixels (keeps 1080p detail). */
  maxDimension: 1920,
  /** Timeline thumbnails: at most this many, at least 1s apart. */
  maxThumbnails: 60,
  minThumbnailIntervalMs: 1000,
  thumbnailWidth: 160,
  posterWidth: 640,
  /** Scene change strength (0–1) that counts as a new moment. */
  sceneThreshold: 0.3,
  maxAutoMarkers: 20,
  minMarkerGapMs: 2000,
  /** Ignore "changes" in the first moments (fade-ins, window chrome). */
  skipStartMs: 500,
} as const

const R = processingRules

/** How many thumbnails, and how far apart, for a clip of `durationMs`. */
export function thumbnailPlan(durationMs: number) {
  const intervalMs = Math.max(
    R.minThumbnailIntervalMs,
    Math.ceil(durationMs / R.maxThumbnails / 100) * 100
  )
  const count = Math.max(
    1,
    Math.min(R.maxThumbnails, Math.ceil(durationMs / intervalMs))
  )
  return { count, intervalMs }
}

export type SceneChange = { atMs: number; score: number }

/**
 * Reads `metadata=print` output from ffmpeg's scene filter: a
 * `pts_time:12.34` line, then that frame's `lavfi.scene_score=0.51`.
 */
export function parseSceneLog(log: string): SceneChange[] {
  const scenes: SceneChange[] = []
  let atMs: number | null = null
  for (const line of log.split("\n")) {
    const time = /pts_time:([\d.]+)/.exec(line)?.[1]
    if (time !== undefined) {
      atMs = Math.round(Number(time) * 1000)
      continue
    }
    const score = /lavfi\.scene_score=([\d.]+)/.exec(line)?.[1]
    if (score !== undefined && atMs !== null) {
      scenes.push({ atMs, score: Number(score) })
      atMs = null
    }
  }
  return scenes
}

/**
 * The strongest scene changes, at least `minMarkerGapMs` apart, in time
 * order. A clip with no clear changes (one static screen) gets evenly
 * spaced moments instead, so every clip has markers to start from.
 */
export function pickAutoMarkers(scenes: SceneChange[], durationMs: number) {
  const kept: number[] = []
  const candidates = scenes
    .filter((s) => s.atMs >= R.skipStartMs && s.atMs < durationMs)
    .sort((a, b) => b.score - a.score)
  for (const { atMs } of candidates) {
    if (kept.length >= R.maxAutoMarkers) break
    if (kept.every((other) => Math.abs(other - atMs) >= R.minMarkerGapMs)) {
      kept.push(atMs)
    }
  }
  if (kept.length === 0 && durationMs >= 2 * R.minMarkerGapMs) {
    return [0.25, 0.5, 0.75].map((f) => Math.round(durationMs * f))
  }
  return kept.sort((a, b) => a - b)
}

// ── ffmpeg arguments ───────────────────────────────────────────────────────

/** H.264 MP4 that starts playing before it fully loads; no audio. */
export function transcodeArgs(input: string, output: string) {
  const max = R.maxDimension
  return [
    "-i",
    input,
    "-map",
    "0:v:0",
    "-an", // ads get a voiceover; recorded sound never leaks in
    "-vf",
    `scale='min(${max},iw)':'min(${max},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ]
}

export function posterArgs(input: string, output: string, durationMs: number) {
  const atSeconds = Math.min(1, durationMs / 2000).toFixed(3)
  return [
    "-ss",
    atSeconds,
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    `scale=${R.posterWidth}:-2`,
    "-q:v",
    "3",
    output,
  ]
}

/** One image: `count` frames side by side, one every `intervalMs`. */
export function thumbnailStripArgs(
  input: string,
  output: string,
  plan: { count: number; intervalMs: number }
) {
  return [
    "-i",
    input,
    "-vf",
    `fps=1000/${plan.intervalMs},scale=${R.thumbnailWidth}:-2,tile=${plan.count}x1`,
    "-frames:v",
    "1",
    "-q:v",
    "4",
    output,
  ]
}

export function sceneDetectArgs(input: string) {
  return [
    "-i",
    input,
    "-an",
    "-vf",
    `scale=320:-2,select='gt(scene,${R.sceneThreshold})',metadata=print`,
    "-f",
    "null",
    "-",
  ]
}
