import { z } from "zod"

/**
 * Smart analysis of a clip (§7.4b), from small frames the worker decodes
 * with ffmpeg. Pure: works on pixel arrays, so it's tested without video.
 *
 * - Activity: per sample, how much of the screen changed and where (a box
 *   in 0–1 frame coordinates). Drives "aim at the action" and graphics.
 * - Idle: stretches where nothing changes (worth speeding up or cutting).
 * - Scrolls: stretches where the page slides up or down.
 * - Palette: the footage's own colours, for matching backgrounds.
 */
export const analysisRules = {
  /** Frames sampled per second (fewer for long clips, see sampleEveryMs). */
  sampleFps: 5,
  maxSamples: 1500,
  /** Long side of the analysis frames, in pixels. */
  gridLong: 160,
  /** Brightness change (0–255) that counts as a changed pixel. */
  pixelThreshold: 18,
  blockSize: 8,
  /** Share of a block's pixels that must change for it to count. */
  blockActive: 0.12,
  /** Below this share of changed pixels the screen is still. */
  idleEnergy: 0.002,
  minIdleMs: 1500,
  /** Scroll search range, in analysis pixels. */
  maxScrollShift: 12,
  /** A box covering more of the frame than this is a page change. */
  pageChangeArea: 0.7,
  paletteWidth: 48,
  maxPaletteFrames: 60,
} as const

const R = analysisRules

export type Box = { x: number; y: number; w: number; h: number }
export type Grid = { w: number; h: number }

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Analysis frame size: long side `gridLong`, even sides, same shape. */
export function gridFor(width: number, height: number): Grid {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  return width >= height
    ? { w: R.gridLong, h: even((R.gridLong * height) / width) }
    : { w: even((R.gridLong * width) / height), h: R.gridLong }
}

/** Time between samples: 200ms, longer when the clip would pass maxSamples. */
export function sampleEveryMs(durationMs: number) {
  const base = 1000 / R.sampleFps
  return Math.max(base, Math.ceil(durationMs / R.maxSamples / 100) * 100)
}

export type FrameDiff = {
  /** Share of pixels that changed (0–1). */
  energy: number
  box: Box | null
  /** Rows the content moved up (+, scrolled down) or down (−); 0 = none. */
  scroll: number
}

/** What changed between two grayscale frames of `grid` size. */
export function diffFrames(
  a: Uint8Array,
  b: Uint8Array,
  grid: Grid
): FrameDiff {
  const { w, h } = grid
  const bs = R.blockSize
  const blocksX = Math.ceil(w / bs)
  const blocksY = Math.ceil(h / bs)
  const blockCounts = new Uint16Array(blocksX * blocksY)
  let changed = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (Math.abs(a[i]! - b[i]!) > R.pixelThreshold) {
        changed++
        blockCounts[Math.floor(y / bs) * blocksX + Math.floor(x / bs)]!++
      }
    }
  }
  const energy = changed / (w * h)

  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const cellW = Math.min(bs, w - bx * bs)
      const cellH = Math.min(bs, h - by * bs)
      if (blockCounts[by * blocksX + bx]! < cellW * cellH * R.blockActive) {
        continue
      }
      minX = Math.min(minX, bx * bs)
      minY = Math.min(minY, by * bs)
      maxX = Math.max(maxX, bx * bs + cellW)
      maxY = Math.max(maxY, by * bs + cellH)
    }
  }
  const box =
    maxX < 0
      ? null
      : {
          x: round3(minX / w),
          y: round3(minY / h),
          w: round3((maxX - minX) / w),
          h: round3((maxY - minY) / h),
        }

  return {
    energy: round3(energy),
    box,
    scroll: energy > 0.05 ? scrollShift(a, b, grid) : 0,
  }
}

/**
 * How far the picture slid vertically between frames: the shift that
 * matches the frames far better than no shift at all, else 0.
 */
function scrollShift(a: Uint8Array, b: Uint8Array, { w, h }: Grid) {
  const error = (dy: number) => {
    let sum = 0
    let count = 0
    // Rows of b that have a partner row in a after shifting.
    for (let y = Math.max(0, -dy); y < Math.min(h, h - dy); y++) {
      const rowA = (y + dy) * w
      const rowB = y * w
      for (let x = 0; x < w; x += 2) {
        sum += Math.abs(a[rowA + x]! - b[rowB + x]!)
        count++
      }
    }
    return count === 0 ? Infinity : sum / count
  }
  const still = error(0)
  let best = 0
  let bestError = still
  for (let dy = -R.maxScrollShift; dy <= R.maxScrollShift; dy++) {
    if (dy === 0) continue
    const e = error(dy)
    if (e < bestError) {
      best = dy
      bestError = e
    }
  }
  return best !== 0 && bestError < still * 0.5 ? best : 0
}

// ── Stored analysis ────────────────────────────────────────────────────────

const unit = z.number().min(0).max(1)

/** [atMs, energy, x, y, w, h]; w = 0 when nothing changed. */
const sampleSchema = z.tuple([
  z.number().int().min(0),
  unit,
  unit,
  unit,
  unit,
  unit,
])
const rangeSchema = z.object({
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
})
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/)

export const analysisSchema = z.object({
  version: z.literal(1),
  sampleMs: z.number().int().positive(),
  activity: z.array(sampleSchema),
  idle: z.array(rangeSchema),
  scrolls: z.array(rangeSchema.extend({ direction: z.enum(["up", "down"]) })),
  palette: z.object({
    colors: z.array(z.object({ hex: hexColor, weight: unit })),
    accents: z.array(hexColor),
    isDark: z.boolean(),
  }),
})
export type FootageAnalysis = z.infer<typeof analysisSchema>
export type Palette = FootageAnalysis["palette"]

/** Stored analysis, or null if missing or from an older format. */
export function parseStoredAnalysis(value: unknown): FootageAnalysis | null {
  const parsed = analysisSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/** Builds the activity track, idle and scroll stretches from frame diffs. */
export function summarizeActivity(diffs: FrameDiff[], sampleMs: number) {
  const activity: FootageAnalysis["activity"] = diffs.map((diff, index) => {
    // A diff compares frame i with i+1: it belongs to the later frame.
    const atMs = (index + 1) * sampleMs
    const box = diff.box ?? { x: 0, y: 0, w: 0, h: 0 }
    return [atMs, diff.energy, box.x, box.y, box.w, box.h]
  })

  const idle: FootageAnalysis["idle"] = []
  let idleStart: number | null = null
  const closeIdle = (endMs: number) => {
    if (idleStart !== null && endMs - idleStart >= R.minIdleMs) {
      idle.push({ startMs: idleStart, endMs })
    }
    idleStart = null
  }
  diffs.forEach((diff, index) => {
    const startMs = index * sampleMs
    if (diff.energy < R.idleEnergy) idleStart ??= startMs
    else closeIdle(startMs)
  })
  closeIdle(diffs.length * sampleMs)

  const scrolls: FootageAnalysis["scrolls"] = []
  diffs.forEach((diff, index) => {
    if (diff.scroll === 0) return
    const direction = diff.scroll > 0 ? "down" : "up"
    const startMs = index * sampleMs
    const endMs = startMs + sampleMs
    const last = scrolls.at(-1)
    // Joins pairs with at most one still sample between them.
    if (
      last &&
      last.direction === direction &&
      startMs - last.endMs <= sampleMs
    ) {
      last.endMs = endMs
    } else {
      scrolls.push({ startMs, endMs, direction })
    }
  })

  return {
    activity,
    idle,
    // A single sliding pair is noise more often than a scroll.
    scrolls: scrolls.filter((s) => s.endMs - s.startMs >= 2 * sampleMs),
  }
}

// ── Palette ────────────────────────────────────────────────────────────────

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`

function hsl(r: number, g: number, b: number) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { s, l }
}

/**
 * The footage's colours from RGB frames: the main tones by share of the
 * screen, the saturated "accent" colours (buttons, charts, highlights)
 * and whether the app looks dark.
 */
export function paletteFrom(rgb: Uint8Array): Palette {
  // 4 bits per channel; each bin keeps the mean of its real colours.
  const counts = new Uint32Array(4096)
  const sums = new Float64Array(4096 * 3)
  let luminance = 0
  const pixels = Math.floor(rgb.length / 3)
  for (let i = 0; i < pixels; i++) {
    const r = rgb[i * 3]!
    const g = rgb[i * 3 + 1]!
    const b = rgb[i * 3 + 2]!
    const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    counts[bin]!++
    sums[bin * 3] = sums[bin * 3]! + r
    sums[bin * 3 + 1] = sums[bin * 3 + 1]! + g
    sums[bin * 3 + 2] = sums[bin * 3 + 2]! + b
    luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  if (pixels === 0) return { colors: [], accents: [], isDark: false }

  const bins = [...counts.keys()]
    .filter((bin) => counts[bin]! > 0)
    .map((bin) => {
      const n = counts[bin]!
      const color = [0, 1, 2].map((c) => sums[bin * 3 + c]! / n) as [
        number,
        number,
        number,
      ]
      return { color, weight: n / pixels }
    })
    .sort((a, b) => b.weight - a.weight)

  const distance = (a: number[], b: number[]) =>
    Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
  const pickDistinct = (
    candidates: typeof bins,
    limit: number,
    minDistance: number
  ) => {
    const picked: typeof bins = []
    for (const candidate of candidates) {
      if (picked.length >= limit) break
      const near = picked.find(
        (other) => distance(other.color, candidate.color) < minDistance
      )
      if (near) near.weight += candidate.weight
      else picked.push({ ...candidate })
    }
    return picked
  }

  const colors = pickDistinct(bins, 6, 48).map(({ color, weight }) => ({
    hex: toHex(...color),
    weight: round3(Math.min(1, weight)),
  }))
  const accents = pickDistinct(
    bins.filter(({ color, weight }) => {
      const { s, l } = hsl(...color)
      return weight >= 0.002 && s >= 0.45 && l >= 0.25 && l <= 0.75
    }),
    3,
    64
  ).map(({ color }) => toHex(...color))

  return { colors, accents, isDark: luminance / pixels < 0.4 }
}

// ── Where the action is ────────────────────────────────────────────────────

export type Action = {
  box: Box
  focusX: number
  focusY: number
  /** Zoom that makes the box fill about 60% of the frame (1–2.2). */
  zoom: number
}

const intersects = (a: Box, b: Box, pad: number) =>
  a.x - pad < b.x + b.w &&
  b.x - pad < a.x + a.w &&
  a.y - pad < b.y + b.h &&
  b.y - pad < a.y + a.h

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

/**
 * Where things happen just after `atMs`: the strongest change in the next
 * 2.5 seconds, grown by the changes touching it. Page changes and scrolls
 * (the whole screen moves) don't count. Null when nothing local happens.
 */
export function actionAt(
  analysis: Pick<FootageAnalysis, "activity" | "scrolls">,
  atMs: number
): Action | null {
  const inScroll = (t: number) =>
    analysis.scrolls.some((s) => t >= s.startMs && t <= s.endMs)
  const boxes = analysis.activity
    .filter(([t, energy, , , w, h]) => {
      if (t < atMs - 200 || t > atMs + 2500) return false
      return energy >= 0.003 && w > 0 && w * h <= R.pageChangeArea
    })
    .filter(([t]) => !inScroll(t))
    .sort((a, b) => b[1] - a[1])
    .map(([, , x, y, w, h]) => ({ x, y, w, h }))
  const [seed] = boxes
  if (!seed) return null

  let box = seed
  for (let pass = 0; pass < 2; pass++) {
    for (const other of boxes) {
      if (intersects(box, other, 0.03)) box = union(box, other)
    }
  }
  const zoom = Math.min(2.2, Math.max(1, 0.6 / Math.max(box.w, box.h)))
  return {
    box: {
      x: round3(box.x),
      y: round3(box.y),
      w: round3(box.w),
      h: round3(box.h),
    },
    focusX: round3(box.x + box.w / 2),
    focusY: round3(box.y + box.h / 2),
    zoom: Math.round(zoom * 20) / 20,
  }
}
