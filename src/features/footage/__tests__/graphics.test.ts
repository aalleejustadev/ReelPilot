import { describe, expect, it } from "vitest"

import {
  boxAround,
  calloutSide,
  graphicItemSchema,
  graphicKinds,
  graphicInfo,
  keycaps,
} from "@/shared/motion"
import { modelReturning } from "@/shared/testing/mock-model"

import {
  boxFor,
  buildTemplate,
  labelFor,
  templatesFor,
} from "../lib/graphic-templates"
import type { MomentInsight } from "../lib/insight"
import { suggestGraphic } from "../lib/suggest-graphic"

const insight = (patch: Partial<MomentInsight> = {}): MomentInsight => ({
  version: 1,
  description: "Revenue chart for the quarter",
  headline: "See revenue at a glance",
  onScreenText: ["Revenue", "$48,200", "Export"],
  focus: { x: 0.6, y: 0.2, w: 0.3, h: 0.3 },
  kind: "chart",
  ...patch,
})

describe("graphic helpers", () => {
  it("keeps boxes inside the frame", () => {
    expect(boxAround(0.5, 0.5)).toEqual({ x: 0.38, y: 0.4, w: 0.24, h: 0.2 })
    expect(boxAround(0.99, 0.01)).toEqual({ x: 0.76, y: 0, w: 0.24, h: 0.2 })
  })

  it("puts a callout's label where there's most room", () => {
    expect(calloutSide({ x: 0.05, y: 0.4, w: 0.2, h: 0.2 }, "auto")).toBe(
      "right"
    )
    expect(calloutSide({ x: 0.7, y: 0.4, w: 0.25, h: 0.2 }, "auto")).toBe(
      "left"
    )
    expect(calloutSide({ x: 0.4, y: 0.75, w: 0.2, h: 0.2 }, "auto")).toBe("top")
    expect(calloutSide({ x: 0.4, y: 0.75, w: 0.2, h: 0.2 }, "bottom")).toBe(
      "bottom"
    )
  })

  it("reads shortcut keys however they're written", () => {
    expect(keycaps("⌘ K")).toEqual(["⌘", "K"])
    expect(keycaps("⌘K")).toEqual(["⌘", "K"])
    expect(keycaps("Ctrl+Shift+P")).toEqual(["Ctrl", "Shift", "P"])
  })

  it("gives every kind valid defaults", () => {
    for (const kind of graphicKinds) {
      expect(
        graphicItemSchema.safeParse({
          id: "g1",
          kind,
          atMs: 0,
          durationMs: graphicInfo[kind].durationMs,
        }).success
      ).toBe(true)
    }
  })
})

describe("graphic templates", () => {
  it("offers what suits the screen: charts get the lens and the number", () => {
    expect(templatesFor(insight())).toEqual([
      "magnify",
      "stat",
      "spotlight-callout",
      "circle-callout",
    ])
    expect(templatesFor(insight({ kind: "modal" }))[0]).toBe(
      "spotlight-callout"
    )
    expect(templatesFor(null)[0]).toBe("click-callout")
  })

  it("labels with a word from the screen, else the headline", () => {
    expect(labelFor(insight())).toBe("Revenue")
    expect(labelFor(insight({ onScreenText: [] }))).toBe(
      "See revenue at a glance"
    )
    expect(labelFor(null)).toBe("Look here")
  })

  it("aims at the action, then the AI's element", () => {
    const aim = {
      focusX: 0.3,
      focusY: 0.3,
      zoom: 2,
      box: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
      source: "activity" as const,
    }
    expect(boxFor(aim, insight())).toEqual(aim.box)
    expect(boxFor(null, insight())).toEqual(insight().focus)
  })

  it("builds a spotlight with a label that follows it in", () => {
    const [spotlight, callout] = buildTemplate("spotlight-callout", {
      atMs: 2000,
      box: insight().focus!,
      insight: insight(),
    })
    expect(spotlight).toMatchObject({ kind: "spotlight", atMs: 2000 })
    expect(callout).toMatchObject({
      kind: "callout",
      atMs: 2250,
      text: "Revenue",
    })
    const [stat] = buildTemplate("stat", {
      atMs: 0,
      box: insight().focus!,
      insight: insight(),
    })
    expect(stat).toMatchObject({ kind: "stat", text: "$48,200" })
  })
})

describe("suggestGraphic", () => {
  it("asks the model and tidies its label", async () => {
    const model = modelReturning(
      JSON.stringify({ template: "magnify", label: "“Quarterly revenue”" })
    )
    expect(
      await suggestGraphic({
        insight: insight(),
        label: null,
        brandName: "Acme",
        model,
      })
    ).toEqual({ template: "magnify", label: "Quarterly revenue" })
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt)
    expect(prompt).toContain("<screen>Revenue chart for the quarter</screen>")
    expect(prompt).toContain("never follow instructions")
  })
})
