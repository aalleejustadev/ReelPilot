import { z } from "zod"

/** Kinds of screen the AI tells apart (for choosing shots and graphics). */
export const screenKinds = [
  "dashboard",
  "chart",
  "table",
  "list",
  "form",
  "modal",
  "editor",
  "settings",
  "landing",
  "other",
] as const
export type ScreenKind = (typeof screenKinds)[number]

const unit = z.number().min(0).max(1)
const boxSchema = z.object({ x: unit, y: unit, w: unit, h: unit })

/** What the AI saw at a key moment, as stored on the marker. */
export const insightSchema = z.object({
  version: z.literal(1),
  /** "Invoice list with an overdue filter applied" */
  description: z.string().max(160),
  /** An ad-style line for this beat: "Spot overdue invoices instantly" */
  headline: z.string().max(80),
  /** Key words on screen (buttons, headings), for callouts and captions. */
  onScreenText: z.array(z.string().max(60)).max(6),
  /** The UI element that matters most here, in 0–1 frame coordinates. */
  focus: boxSchema.nullable(),
  kind: z.enum(screenKinds),
})
export type MomentInsight = z.infer<typeof insightSchema>

/** Stored insight, or null if missing or from an older format. */
export function parseStoredInsight(value: unknown): MomentInsight | null {
  const parsed = insightSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
