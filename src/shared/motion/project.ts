import { z } from "zod"

import { transitionSchema, type Transition } from "./edit"

/**
 * Projects (M4): clips played one after another, each coming in from the
 * one before with a transition. Like a clip's own parts (edit.ts), a
 * transition overlaps the two clips, fitted to half of either.
 */
export const projectLimits = { clips: 30, name: 80 } as const

export const projectClipSchema = z.object({
  footageId: z.string().min(1),
  /** How it comes in from the clip before (ignored on the first). */
  transition: transitionSchema,
})
export type ProjectClipInput = z.output<typeof projectClipSchema>

/** A new clip comes in with a cut until the owner picks a transition. */
export const defaultClipTransition: Transition = {
  kind: "cut",
  durationMs: 0,
  direction: "left",
}

export type ProjectSlot = {
  /** When it starts and ends in the project (ms). */
  startMs: number
  endMs: number
  /** How long it overlaps the clip before (its transition in). */
  inMs: number
}

/**
 * Where each clip plays in the project, from each clip's own length (its
 * edited ad length) and how it comes in.
 */
export function projectLayout(
  clips: { lengthMs: number; transition: Transition }[]
): { slots: ProjectSlot[]; durationMs: number } {
  const slots: ProjectSlot[] = []
  let cursor = 0
  clips.forEach((clip, i) => {
    const length = Math.max(1, clip.lengthMs)
    const previous = clips[i - 1]
    const inMs =
      previous && clip.transition.kind !== "cut"
        ? Math.round(
            Math.min(
              clip.transition.durationMs,
              length / 2,
              Math.max(1, previous.lengthMs) / 2
            )
          )
        : 0
    const startMs = cursor - inMs
    slots.push({ startMs, endMs: startMs + length, inMs })
    cursor = startMs + length
  })
  return { slots, durationMs: Math.max(0, cursor) }
}

/** The clip showing at `ms` (in a transition, the incoming one). */
export function clipAt(slots: ProjectSlot[], ms: number) {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (ms >= slots[i]!.startMs) return Math.min(i, slots.length - 1)
  }
  return 0
}
