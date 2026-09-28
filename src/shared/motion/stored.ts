import { defaultPresentation } from "./presets"
import {
  presentationSchema,
  shotSchema,
  type Presentation,
  type Shot,
} from "./schema"

/** A stored shot, or null if missing or no longer valid. */
export function parseStoredShot(value: unknown): Shot | null {
  return shotSchema.safeParse(value).data ?? null
}

/**
 * The clip's presentation: its own if set, otherwise defaults with the
 * brand kit's colours as the background.
 */
export function presentationFor(
  stored: unknown,
  brandColors: { primary?: string; secondary?: string }
): Presentation {
  const own = presentationSchema.safeParse(stored).data
  if (own) return own
  const from = brandColors.primary ?? defaultPresentation.background.from
  const to = brandColors.secondary ?? defaultPresentation.background.to
  return { ...defaultPresentation, background: { kind: "gradient", from, to } }
}
