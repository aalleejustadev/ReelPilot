import { z } from "zod"

/**
 * Motion graphics (§7.4b F). Screen graphics are pinned to a box on the
 * recording (0–1 of the frame) and move with the camera, so they stay on
 * the button or chart they point at; stage graphics sit over the stage.
 * Times work like text: a start in footage time, a length in ad time.
 */
export const graphicKinds = [
  // On the screen
  "ripple",
  "spotlight",
  "magnifier",
  "callout",
  "circle",
  "underline",
  "privacy",
  // On the stage
  "keys",
  "stat",
  "lower-third",
  "logo",
  "end-card",
] as const
export type GraphicKind = (typeof graphicKinds)[number]

export const screenGraphics: readonly GraphicKind[] = [
  "ripple",
  "spotlight",
  "magnifier",
  "callout",
  "circle",
  "underline",
  "privacy",
]
export const isScreenGraphic = (kind: GraphicKind) =>
  screenGraphics.includes(kind)

export const graphicInfo: Record<
  GraphicKind,
  {
    label: string
    hint: string
    durationMs: number
    /** What its text fields mean ("" = no field). */
    text: string
    secondary: string
  }
> = {
  ripple: {
    label: "Click ripple",
    hint: "Rings where something is clicked.",
    durationMs: 900,
    text: "",
    secondary: "",
  },
  spotlight: {
    label: "Spotlight",
    hint: "Dims everything but this.",
    durationMs: 2200,
    text: "",
    secondary: "",
  },
  magnifier: {
    label: "Magnifier",
    hint: "A lens showing this area 2× larger.",
    durationMs: 2400,
    text: "",
    secondary: "",
  },
  callout: {
    label: "Callout",
    hint: "A label with a drawn arrow.",
    durationMs: 2400,
    text: "Label",
    secondary: "",
  },
  circle: {
    label: "Circle it",
    hint: "A hand-drawn circle around it.",
    durationMs: 2000,
    text: "",
    secondary: "",
  },
  underline: {
    label: "Underline",
    hint: "A hand-drawn stroke under it.",
    durationMs: 1800,
    text: "",
    secondary: "",
  },
  privacy: {
    label: "Privacy blur",
    hint: "Hides emails, names or keys.",
    durationMs: 4000,
    text: "",
    secondary: "",
  },
  keys: {
    label: "Shortcut keys",
    hint: "Keycaps that pop in: ⌘ K.",
    durationMs: 1800,
    text: "Keys",
    secondary: "",
  },
  stat: {
    label: "Stat card",
    hint: "A number that counts up, with a label.",
    durationMs: 2600,
    text: "Number",
    secondary: "Label",
  },
  "lower-third": {
    label: "Lower third",
    hint: "A title and line, bottom left.",
    durationMs: 3000,
    text: "Title",
    secondary: "Line",
  },
  logo: {
    label: "Logo reveal",
    hint: "Your logo resolves into view.",
    durationMs: 2000,
    text: "",
    secondary: "",
  },
  "end-card": {
    label: "End card",
    hint: "Logo, headline and a call to action.",
    durationMs: 3000,
    text: "Headline",
    secondary: "Button",
  },
}

export const graphicLimits = { items: 30, text: 80 } as const

const unit = z.number().min(0).max(1)

export const graphicBoxSchema = z.object({ x: unit, y: unit, w: unit, h: unit })
export type GraphicBox = z.infer<typeof graphicBoxSchema>

export const graphicItemSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(graphicKinds),
  atMs: z.number().int().min(0),
  durationMs: z.number().int().min(400).max(15_000),
  /** Screen graphics: the area on the recording (0–1 of the frame). */
  box: graphicBoxSchema.default({ x: 0.38, y: 0.4, w: 0.24, h: 0.2 }),
  text: z.string().max(graphicLimits.text).default(""),
  secondary: z.string().max(graphicLimits.text).default(""),
  /** Callouts: which side of the box the label sits on. */
  side: z.enum(["auto", "left", "right", "top", "bottom"]).default("auto"),
})
export type GraphicItem = z.output<typeof graphicItemSchema>

/** A box `w`×`h` centred on a point, kept inside the frame. */
export function boxAround(x: number, y: number, w = 0.24, h = 0.2) {
  const clamp = (n: number, size: number) =>
    Math.min(1 - size, Math.max(0, n - size / 2))
  return { x: clamp(x, w), y: clamp(y, h), w, h }
}

/** Where a callout's label goes: the side with the most room. */
export function calloutSide(box: GraphicBox, side: GraphicItem["side"]) {
  if (side !== "auto") return side
  const room = {
    left: box.x,
    right: 1 - (box.x + box.w),
    top: box.y,
    bottom: 1 - (box.y + box.h),
  }
  return (Object.entries(room) as [keyof typeof room, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0]![0]
}

/** Keycaps from "⌘+K", "Ctrl Shift P" or "⌘K". */
export function keycaps(text: string) {
  const parts = text
    .split(/[\s+]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 1 && /^[⌘⌥⇧⌃]+.$/u.test(parts[0]!)) {
    return [...parts[0]!]
  }
  return parts.slice(0, 5)
}
