import { z } from "zod"

/**
 * Cuts, speed and transitions (§7.4b D). The clip is split into parts
 * that tile the footage from 0 to its end; each part is kept or removed,
 * plays at a speed, and enters with a transition from the part before.
 * The ad's timeline ("output") is the kept parts in order, overlapping by
 * each transition, like an editor's transition between two clips.
 *
 * Times called `sourceMs` are in the footage; `outputMs` in the ad.
 */
export const transitionKinds = [
  "cut",
  "push",
  "whip",
  "zoom",
  "blur",
  "iris",
] as const
export type TransitionKind = (typeof transitionKinds)[number]
export const transitionDirections = ["left", "right", "up", "down"] as const
export type TransitionDirection = (typeof transitionDirections)[number]

/** Pro defaults (research: 8–18 frames at 30fps; whips are the quickest). */
export const transitionDefaults: Record<
  TransitionKind,
  { label: string; durationMs: number; directions: TransitionDirection[] }
> = {
  cut: { label: "Cut", durationMs: 0, directions: [] },
  push: {
    label: "Push",
    durationMs: 500,
    directions: ["left", "right", "up", "down"],
  },
  whip: { label: "Whip pan", durationMs: 350, directions: ["left", "right"] },
  zoom: { label: "Zoom through", durationMs: 450, directions: [] },
  blur: { label: "Blur dissolve", durationMs: 500, directions: [] },
  iris: { label: "Circle reveal", durationMs: 600, directions: [] },
}

export const speeds = [1, 1.5, 2, 4, 8] as const
export type Speed = (typeof speeds)[number]

export const transitionSchema = z.object({
  kind: z.enum(transitionKinds),
  durationMs: z.number().int().min(0).max(1500),
  direction: z.enum(transitionDirections).default("left"),
})
export type Transition = z.output<typeof transitionSchema>

export const partSchema = z.object({
  startMs: z.number().int().min(0),
  removed: z.boolean().default(false),
  speed: z
    .number()
    .refine((n) => (speeds as readonly number[]).includes(n))
    .default(1),
  /** How this part enters from the kept part before it. */
  transition: transitionSchema.default({
    kind: "cut",
    durationMs: 0,
    direction: "left",
  }),
})
export type Part = z.output<typeof partSchema>

export const editLimits = { parts: 60 } as const

/** No parts = the whole clip, kept, at normal speed. */
export const clipEditSchema = z.object({
  parts: z
    .array(partSchema)
    .max(editLimits.parts)
    .refine(
      (parts) =>
        parts.length === 0 ||
        (parts[0]!.startMs === 0 &&
          parts.every((p, i) => i === 0 || p.startMs > parts[i - 1]!.startMs)),
      "Parts must start at 0 and be in order."
    )
    .default([]),
})
export type ClipEdit = z.output<typeof clipEditSchema>

export const emptyEdit: ClipEdit = { parts: [] }

const cutIn: Transition = { kind: "cut", durationMs: 0, direction: "left" }

/** The parts with their ends, covering 0–duration (at least one). */
export function partsOf(edit: ClipEdit, durationMs: number) {
  const parts: Part[] =
    edit.parts.length > 0
      ? edit.parts.filter((p) => p.startMs < durationMs)
      : [{ startMs: 0, removed: false, speed: 1, transition: cutIn }]
  return parts.map((part, i) => ({
    ...part,
    index: i,
    endMs: parts[i + 1]?.startMs ?? durationMs,
  }))
}
export type TimedPart = ReturnType<typeof partsOf>[number]

/**
 * Where each kept part sits in the ad. A transition overlaps the end of
 * the part before and the start of its own part; it's shortened to fit
 * half of either. The first kept part enters with a cut.
 */
export function outputLayout(edit: ClipEdit, durationMs: number) {
  const kept = partsOf(edit, durationMs).filter((p) => !p.removed)
  const layout: (TimedPart & {
    outStartMs: number
    outEndMs: number
    /** The transition into this part, fitted (0 for the first). */
    inMs: number
  })[] = []
  let cursor = 0
  kept.forEach((part, i) => {
    const lengthMs = (part.endMs - part.startMs) / part.speed
    const previous = layout[i - 1]
    const inMs =
      previous && part.transition.kind !== "cut"
        ? Math.min(
            part.transition.durationMs,
            lengthMs / 2,
            (previous.outEndMs - previous.outStartMs) / 2
          )
        : 0
    const outStartMs = previous ? cursor - inMs : 0
    layout.push({ ...part, outStartMs, outEndMs: outStartMs + lengthMs, inMs })
    cursor = outStartMs + lengthMs
  })
  return layout
}

/** The ad's length after cuts, speed changes and transitions. */
export function outputDuration(edit: ClipEdit, durationMs: number) {
  return outputLayout(edit, durationMs).at(-1)?.outEndMs ?? 0
}

/** Ad time → footage time. In a transition, the incoming part from halfway. */
export function toSource(edit: ClipEdit, durationMs: number, outputMs: number) {
  const layout = outputLayout(edit, durationMs)
  let current = layout[0]
  for (const part of layout) {
    if (outputMs >= part.outStartMs + part.inMs / 2) current = part
  }
  if (!current) return 0
  const into = Math.max(0, outputMs - current.outStartMs) * current.speed
  return Math.min(current.endMs, current.startMs + into)
}

/** Footage time → ad time, or null if that part of the footage is cut. */
export function toOutput(edit: ClipEdit, durationMs: number, sourceMs: number) {
  const layout = outputLayout(edit, durationMs)
  const part = layout.find(
    (p) =>
      sourceMs >= p.startMs && (sourceMs < p.endMs || p.endMs === durationMs)
  )
  if (!part) return null
  return part.outStartMs + (sourceMs - part.startMs) / part.speed
}

/** Footage time → ad time, snapping cut footage to the next kept part. */
export function toOutputNearest(
  edit: ClipEdit,
  durationMs: number,
  sourceMs: number
) {
  const direct = toOutput(edit, durationMs, sourceMs)
  if (direct !== null) return direct
  const layout = outputLayout(edit, durationMs)
  const next = layout.find((p) => p.startMs >= sourceMs)
  return next ? next.outStartMs : (layout.at(-1)?.outEndMs ?? 0)
}

// ── Operations (return a new edit; the input is never changed) ─────────────

const minPartMs = 200

function explicitParts(edit: ClipEdit): Part[] {
  return edit.parts.length > 0
    ? edit.parts.map((p) => ({ ...p }))
    : [{ startMs: 0, removed: false, speed: 1, transition: cutIn }]
}

/** Splits the part under `atMs` in two (the new part inherits its settings). */
export function splitAt(edit: ClipEdit, durationMs: number, atMs: number) {
  const at = Math.round(atMs)
  const parts = explicitParts(edit)
  const index = parts.findLastIndex((p) => p.startMs <= at)
  const part = parts[index]
  const end = parts[index + 1]?.startMs ?? durationMs
  if (!part || at - part.startMs < minPartMs || end - at < minPartMs) {
    return edit
  }
  if (parts.length >= editLimits.parts) return edit
  parts.splice(index + 1, 0, { ...part, startMs: at, transition: cutIn })
  return { parts }
}

/** Joins part `index` with the part before it (the earlier one's settings win). */
export function joinWithPrevious(edit: ClipEdit, index: number) {
  if (index <= 0 || index >= edit.parts.length) return edit
  const parts = explicitParts(edit)
  parts.splice(index, 1)
  return { parts: parts.length === 1 && isPlain(parts[0]!) ? [] : parts }
}

const isPlain = (part: Part) =>
  !part.removed && part.speed === 1 && part.transition.kind === "cut"

/** Changes part `index`. */
export function updatePart(
  edit: ClipEdit,
  index: number,
  patch: Partial<Omit<Part, "startMs">>
) {
  const parts = explicitParts(edit)
  const part = parts[index]
  if (!part) return edit
  parts[index] = { ...part, ...patch }
  // Keep at least one part of the footage in the ad.
  if (parts.every((p) => p.removed)) return edit
  return { parts }
}

/**
 * Applies `patch` to the footage from `startMs` to `endMs` (splitting at
 * both ends as needed), e.g. to speed up or cut a still stretch.
 */
export function updateRange(
  edit: ClipEdit,
  durationMs: number,
  startMs: number,
  endMs: number,
  patch: Partial<Omit<Part, "startMs">>
) {
  let next = splitAt(splitAt(edit, durationMs, startMs), durationMs, endMs)
  const parts = explicitParts(next)
  parts.forEach((part, i) => {
    const end = parts[i + 1]?.startMs ?? durationMs
    if (part.startMs >= startMs - 1 && end <= endMs + 1) {
      parts[i] = { ...part, ...patch }
    }
  })
  if (parts.every((p) => p.removed)) return edit
  next = { parts }
  return next
}
