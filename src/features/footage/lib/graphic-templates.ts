import {
  boxAround,
  defaultFocus,
  graphicInfo,
  isLayoutGraphic,
  type GraphicBox,
  type GraphicItem,
  type GraphicKind,
} from "@/shared/motion"

import type { Aim } from "./aim"
import type { MomentInsight, ScreenKind } from "./insight"

/**
 * "Turn a moment into a graphic" (§7.4b F): tailored combinations chosen
 * by what's on screen (from the analysis), aimed at the action's box.
 */
export const graphicTemplateIds = [
  "spotlight-callout",
  "magnify",
  "circle-callout",
  "click-callout",
  "stat",
  "privacy",
] as const
export type GraphicTemplateId = (typeof graphicTemplateIds)[number]

export const graphicTemplates: Record<
  GraphicTemplateId,
  { title: string; hint: string }
> = {
  "spotlight-callout": {
    title: "Spotlight + label",
    hint: "Dims the rest, names the feature",
  },
  magnify: { title: "Magnify", hint: "A 2× lens on the detail" },
  "circle-callout": {
    title: "Circle + label",
    hint: "Hand-drawn, like a review",
  },
  "click-callout": {
    title: "Click + label",
    hint: "Shows the click, then names it",
  },
  stat: { title: "Stat card", hint: "The number that matters, counting up" },
  privacy: { title: "Hide details", hint: "Blurs private information" },
}

/** Best templates first for each kind of screen. */
const byScreen: Record<ScreenKind, GraphicTemplateId[]> = {
  modal: ["spotlight-callout", "click-callout", "circle-callout", "magnify"],
  form: ["spotlight-callout", "click-callout", "circle-callout", "magnify"],
  settings: ["spotlight-callout", "click-callout", "circle-callout", "magnify"],
  chart: ["magnify", "stat", "spotlight-callout", "circle-callout"],
  dashboard: ["magnify", "stat", "spotlight-callout", "circle-callout"],
  table: ["circle-callout", "spotlight-callout", "magnify", "click-callout"],
  list: ["circle-callout", "spotlight-callout", "magnify", "click-callout"],
  editor: ["click-callout", "magnify", "spotlight-callout", "circle-callout"],
  landing: ["spotlight-callout", "circle-callout", "click-callout", "magnify"],
  other: ["click-callout", "spotlight-callout", "circle-callout", "magnify"],
}

const hasNumber = (text: string) => /\d/.test(text)

/** The templates to offer for a moment, best first (four). */
export function templatesFor(insight: MomentInsight | null) {
  const order = byScreen[insight?.kind ?? "other"]
  const number = insight?.onScreenText.find(hasNumber)
  const list =
    number && !order.includes("stat")
      ? [...order.slice(0, 3), "stat" as const]
      : order
  return list.slice(0, 4)
}

/** A short label for callouts: a word on screen, else the headline. */
export function labelFor(insight: MomentInsight | null) {
  const word = insight?.onScreenText.find(
    (text) => text.length >= 3 && text.length <= 28 && !hasNumber(text)
  )
  if (word) return word
  // Headline ideas are short (under 7 words): cutting one mid-phrase reads badly.
  return insight?.headline || "Look here"
}

/** The area a moment's graphics point at. */
export function boxFor(
  aim: Aim | null,
  insight: MomentInsight | null
): GraphicBox {
  if (aim?.box) return aim.box
  if (insight?.focus) return insight.focus
  if (aim) return boxAround(aim.focusX, aim.focusY)
  return boxAround(0.5, 0.5)
}

/** A short, unique id for an item on the ad ("t…" text, "g…" graphics). */
export const newItemId = (prefix: "t" | "g") =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** One graphic with its kind's defaults. */
export function newGraphic(
  kind: GraphicKind,
  patch: Partial<GraphicItem> & Pick<GraphicItem, "atMs">
): GraphicItem {
  return {
    id: newItemId("g"),
    kind,
    durationMs: graphicInfo[kind].durationMs,
    box: boxAround(0.5, 0.5),
    // Layouts start with words to edit, so they read as what they are.
    text:
      kind === "slide"
        ? "Your big idea"
        : kind === "split"
          ? "Say what it does"
          : "",
    secondary: isLayoutGraphic(kind) ? "One line that backs it up" : "",
    side: kind === "split" ? "left" : "auto",
    track: 0,
    at: null,
    focus: defaultFocus,
    textSize: 1,
    secondarySize: 1,
    ...patch,
  }
}

/** The graphics a template makes for a moment at `atMs`. */
export function buildTemplate(
  template: GraphicTemplateId,
  input: {
    atMs: number
    box: GraphicBox
    insight: MomentInsight | null
    label?: string
  }
): GraphicItem[] {
  const { atMs, box } = input
  const label = input.label?.trim() || labelFor(input.insight)
  switch (template) {
    case "spotlight-callout":
      return [
        newGraphic("spotlight", { atMs, box }),
        newGraphic("callout", {
          atMs: atMs + 250,
          box,
          text: label,
          durationMs: 2100,
        }),
      ]
    case "magnify":
      return [newGraphic("magnifier", { atMs, box })]
    case "circle-callout":
      return [
        newGraphic("circle", { atMs, box }),
        newGraphic("callout", {
          atMs: atMs + 350,
          box,
          text: label,
          durationMs: 1900,
        }),
      ]
    case "click-callout":
      return [
        newGraphic("ripple", { atMs, box }),
        newGraphic("callout", {
          atMs: atMs + 300,
          box,
          text: label,
          durationMs: 2100,
        }),
      ]
    case "stat": {
      const number = input.insight?.onScreenText.find(hasNumber) ?? "3×"
      return [
        newGraphic("stat", {
          atMs,
          text: number,
          secondary: input.label?.trim() || (input.insight?.headline ?? ""),
        }),
      ]
    }
    case "privacy":
      return [newGraphic("privacy", { atMs, box, durationMs: 4000 })]
  }
}
