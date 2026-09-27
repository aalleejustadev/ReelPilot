import {
  outputDuration,
  toSource,
  updateRange,
  type GraphicItem,
  type Presentation,
  type Shot,
  type TextItem,
} from "@/shared/motion"

import type { Aim } from "./aim"
import type { EditPlan, EditScope } from "./direct-edit"
import {
  boxFor,
  buildTemplate,
  newGraphic,
  newItemId,
} from "./graphic-templates"
import type { MomentInsight } from "./insight"
import { lensLooks } from "./lens-looks"
import { applyLook, looks } from "./looks"

type Motion = { shots: Record<string, Shot | null>; presentation: Presentation }

export type PlanMoment = {
  id: string
  atMs: number
  aim: Aim | null
  insight: MomentInsight | null
}

const textSpots = {
  headline: { x: 0.5, y: 0.14 },
  kicker: { x: 0.5, y: 0.1 },
  label: { x: 0.5, y: 0.86 },
} as const

/**
 * Turns the AI's plan into an edit with the deterministic engines (camera
 * rules, cuts, text, graphics, lens), changing only what `scope` allows.
 * Text and graphics in scope are replaced (undo brings the old ones back).
 */
export function applyPlan(
  plan: EditPlan,
  input: {
    moments: PlanMoment[]
    current: Motion
    durationMs: number
    idle: { startMs: number; endMs: number }[]
    scope: EditScope
  }
): Motion {
  const { moments, durationMs, scope } = input
  let { shots, presentation } = input.current

  if (scope.camera && looks.some((look) => look.id === plan.look)) {
    const looked = applyLook(
      plan.look,
      moments,
      { shots, presentation },
      { take: plan.take }
    )
    shots = looked.shots
    presentation = looked.presentation
  }

  if (scope.cuts && plan.stillParts !== "keep") {
    let edit = presentation.edit
    for (const range of input.idle) {
      edit = updateRange(
        edit,
        durationMs,
        range.startMs + 150,
        range.endMs - 150,
        plan.stillParts === "speed" ? { speed: 4 } : { removed: true }
      )
    }
    presentation = { ...presentation, edit }
  }

  const byId = new Map(moments.map((m) => [m.id, m]))
  const ordered = [...moments].sort((a, b) => a.atMs - b.atMs)
  const nextAfter = (atMs: number) =>
    ordered.find((m) => m.atMs > atMs + 50)?.atMs

  if (scope.text) {
    const texts: TextItem[] = plan.texts.flatMap((t) => {
      const moment = byId.get(t.markerId)
      if (!moment) return []
      // Stays until just before the next moment (1.2–3s).
      const next = nextAfter(moment.atMs)
      const durationMs = Math.round(
        Math.min(
          3000,
          Math.max(1200, (next ?? moment.atMs + 3000) - moment.atMs - 200)
        )
      )
      return [
        {
          id: newItemId("t"),
          atMs: moment.atMs,
          durationMs,
          text: t.text,
          role: t.role,
          animation: null,
          ...textSpots[t.role],
          align: "center" as const,
          emphasis: t.text.toLowerCase().includes(t.emphasis.toLowerCase())
            ? t.emphasis
            : "",
        },
      ]
    })
    presentation = {
      ...presentation,
      textStyle: { animation: plan.textStyle },
      texts,
    }
  }

  if (scope.graphics) {
    const graphics: GraphicItem[] = plan.graphics.flatMap((g) => {
      const moment = byId.get(g.markerId)
      if (!moment) return []
      return buildTemplate(g.template, {
        atMs: moment.atMs,
        box: boxFor(moment.aim, moment.insight),
        insight: moment.insight,
        label: g.label,
      })
    })
    if (plan.endCard) {
      // The last 3 seconds of the ad, placed in footage time.
      const adEnd = outputDuration(presentation.edit, durationMs)
      const atMs = Math.round(
        toSource(presentation.edit, durationMs, Math.max(0, adEnd - 3000))
      )
      graphics.push(
        newGraphic("end-card", {
          atMs,
          durationMs: 3000,
          text: plan.endCard.headline,
          secondary: plan.endCard.cta,
        })
      )
    }
    presentation = { ...presentation, graphics }
  }

  if (scope.lens) {
    const lens = lensLooks.find((look) => look.id === plan.lens)
    if (lens) presentation = { ...presentation, lens: lens.lens }
  }

  return { shots, presentation }
}

/** "Product launch look, take 2 · still parts sped up · 3 headlines…" */
export function planSummary(plan: EditPlan, scope: EditScope) {
  const parts: string[] = []
  if (scope.camera) {
    const look = looks.find((l) => l.id === plan.look)
    if (look)
      parts.push(
        `${look.title} look${plan.take ? `, take ${plan.take + 1}` : ""}`
      )
  }
  if (scope.cuts && plan.stillParts !== "keep") {
    parts.push(
      plan.stillParts === "speed" ? "still parts sped up" : "still parts cut"
    )
  }
  if (scope.text && plan.texts.length) {
    parts.push(
      `${plan.texts.length} ${plan.texts.length === 1 ? "line" : "lines"} of text`
    )
  }
  if (scope.graphics && plan.graphics.length) {
    parts.push(
      `${plan.graphics.length} ${plan.graphics.length === 1 ? "graphic" : "graphics"}`
    )
  }
  if (scope.graphics && plan.endCard) parts.push("an end card")
  if (scope.lens) {
    const lens = lensLooks.find((l) => l.id === plan.lens)
    if (lens) parts.push(`${lens.title.toLowerCase()} lens`)
  }
  return parts.join(" · ")
}
