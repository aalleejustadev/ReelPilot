import { z } from "zod"

/**
 * Text on the ad (§7.4b E). Each text item appears at a time in the
 * footage (so cuts and speed changes keep it with its moment) and stays
 * for a length of ad time. Every item animates in with the video's text
 * style unless it picks its own: one style per video reads as designed.
 */
export const textAnimations = [
  "word-rise",
  "mask-reveal",
  "blur-resolve",
  "marker-sweep",
  "keyword-swap",
  "typewriter",
  "number-ticker",
  "tracking-in",
] as const
export type TextAnimation = (typeof textAnimations)[number]

export const textAnimationLabels: Record<
  TextAnimation,
  { label: string; hint: string }
> = {
  "word-rise": { label: "Word rise", hint: "Words rise in one after another." },
  "mask-reveal": {
    label: "Mask reveal",
    hint: "Words slide up from behind a line.",
  },
  "blur-resolve": {
    label: "Blur resolve",
    hint: "Comes into focus. Calm and premium.",
  },
  "marker-sweep": {
    label: "Marker sweep",
    hint: "A highlighter sweeps under the key words.",
  },
  "keyword-swap": {
    label: "Keyword swap",
    hint: "Rolls through words: Ship {faster|safer|together}.",
  },
  typewriter: { label: "Typewriter", hint: "Types itself, with a cursor." },
  "number-ticker": {
    label: "Number ticker",
    hint: "Numbers count up to their value.",
  },
  "tracking-in": {
    label: "Tracking in",
    hint: "Letters draw together. Bold titles.",
  },
}

export const textRoles = ["headline", "kicker", "label", "caption"] as const
export type TextRole = (typeof textRoles)[number]

export const textRoleLabels: Record<TextRole, string> = {
  headline: "Headline",
  kicker: "Kicker",
  label: "Label",
  caption: "Caption",
}

export const textLimits = { items: 30, text: 140, emphasis: 60 } as const

const unit = z.number().min(0).max(1)

export const textItemSchema = z.object({
  id: z.string().min(1).max(40),
  /** When it appears, in footage time. */
  atMs: z.number().int().min(0),
  /** How long it stays, in ad time. */
  durationMs: z.number().int().min(600).max(15_000),
  text: z.string().trim().min(1).max(textLimits.text),
  role: z.enum(textRoles),
  /** Its own animation; null = the video's text style. */
  animation: z.enum(textAnimations).nullable().default(null),
  /** Anchor point on the stage (0–1), and how lines align to it. */
  x: unit,
  y: unit,
  align: z.enum(["left", "center", "right"]),
  /** Words to highlight (in the text), e.g. the benefit. */
  emphasis: z.string().max(textLimits.emphasis).default(""),
  /** Layer: higher tracks draw over lower ones (0 sits on the video). */
  track: z.number().int().min(0).max(9).default(0),
})
export type TextItem = z.output<typeof textItemSchema>

export const textStyleSchema = z.object({
  animation: z.enum(textAnimations).default("word-rise"),
})

// ── Pure helpers used by the stage ─────────────────────────────────────────

/**
 * "Ship {faster|safer|together}" → prefix "Ship ", words and the rest.
 * Null when there's no {a|b} group (or only one word in it).
 */
export function parseSwap(text: string) {
  const match = /^(.*?)\{([^{}]+)\}(.*)$/.exec(text)
  if (!match) return null
  const words = match[2]!
    .split("|")
    .map((word) => word.trim())
    .filter(Boolean)
  if (words.length < 2) return null
  return { before: match[1]!, words, after: match[3]! }
}

/** Plain text, with any {a|b} group shown as its first word. */
export function plainText(text: string) {
  const swap = parseSwap(text)
  return swap ? `${swap.before}${swap.words[0]}${swap.after}` : text
}

/**
 * The text with numbers counted `t` (0–1) of the way to their value,
 * keeping their format: "$4,200" → "$2,100" halfway; "98.5%" keeps one
 * decimal. Null when the text has no numbers.
 */
export function countNumbers(text: string, t: number) {
  let found = false
  const counted = text.replace(/\d[\d,]*(?:\.\d+)?/g, (raw) => {
    found = true
    const value = Number(raw.replace(/,/g, ""))
    const decimals = raw.includes(".") ? (raw.split(".")[1]?.length ?? 0) : 0
    const now = value * Math.min(1, Math.max(0, t))
    const fixed = now.toFixed(decimals)
    if (!raw.includes(",")) return fixed
    const [whole, fraction] = fixed.split(".")
    const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return fraction ? `${grouped}.${fraction}` : grouped
  })
  return found ? counted : null
}

/** 0 (black) … 1 (white), WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Near-white text on dark colours, near-black on light ones. */
export function readableOn(hex: string) {
  return luminance(hex) > 0.4 ? "#15171c" : "#ffffff"
}
