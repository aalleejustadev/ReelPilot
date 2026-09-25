import { describe, expect, it } from "vitest"

import {
  clip,
  fallbackName,
  toDraftFields,
  type AiDraft,
} from "../lib/draft-fields"
import type { PageFacts } from "../lib/read-page"
import { brandKitLimits } from "../schema"

const facts: PageFacts = {
  url: "https://www.acme.app/",
  title: "Acme — Invoices on autopilot",
  description: "Acme sends and chases invoices.",
  siteName: null,
  text: "…",
  colors: ["#ff5a1f", "#2f6bff"],
  fonts: ["Space Grotesk"],
  logoUrls: [],
  pricingUrl: null,
}

const ai: AiDraft = {
  name: "Acme",
  description: "Invoicing that chases late payers for freelancers.",
  audience: "Freelancers and small studios",
  features: ["Automatic reminders", "Stripe payouts"],
  pricingSummary: "Free for 3 clients; Pro $12/month.",
  claims: [
    { text: "Get paid 2x faster", page: "homepage" },
    { text: "No card needed", page: "pricing" },
    { text: "   ", page: "homepage" },
  ],
  tone: "Friendly, plain",
}

describe("clip", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(clip("  a   b ", 10)).toBe("a b")
  })

  it("cuts at the last word boundary, never mid-word", () => {
    expect(clip("one two three four", 12)).toBe("one two")
  })

  it("hard-cuts a single long word", () => {
    expect(clip("abcdefghij", 4)).toBe("abcd")
  })
})

describe("fallbackName", () => {
  it("prefers the site name", () => {
    expect(fallbackName({ ...facts, siteName: "Acme Inc" })).toBe("Acme Inc")
  })

  it("uses the title before its separator", () => {
    expect(fallbackName(facts)).toBe("Acme")
  })

  it("falls back to the hostname without www", () => {
    expect(fallbackName({ ...facts, title: null })).toBe("acme.app")
  })
})

describe("toDraftFields", () => {
  it("combines the AI draft with the page's colours and fonts", () => {
    const fields = toDraftFields(facts, ai, "https://www.acme.app/pricing")

    expect(fields).toEqual({
      name: "Acme",
      url: "https://www.acme.app/",
      description: "Invoicing that chases late payers for freelancers.",
      audience: "Freelancers and small studios",
      features: ["Automatic reminders", "Stripe payouts"],
      pricingSummary: "Free for 3 clients; Pro $12/month.",
      claims: [
        { text: "Get paid 2x faster", sourceUrl: "https://www.acme.app/" },
        { text: "No card needed", sourceUrl: "https://www.acme.app/pricing" },
      ],
      bannedWords: [],
      colors: { primary: "#ff5a1f", secondary: "#2f6bff" },
      fonts: { heading: "Space Grotesk", body: "Space Grotesk" },
      tone: "Friendly, plain",
    })
  })

  it("builds a valid partial draft from page metadata when the AI failed", () => {
    const fields = toDraftFields(facts, null, null)

    expect(fields).toMatchObject({
      name: "Acme",
      description: "Acme sends and chases invoices.",
      audience: "",
      features: [],
      claims: [],
      pricingSummary: null,
      tone: null,
    })
  })

  it("falls back to the meta description when the AI leaves it empty", () => {
    expect(
      toDraftFields(facts, { ...ai, description: "" }, null).description
    ).toBe("Acme sends and chases invoices.")
  })

  it("clips over-long AI output to the field limits instead of failing", () => {
    const long = "word ".repeat(200)
    const fields = toDraftFields(
      facts,
      {
        ...ai,
        name: long,
        description: long,
        features: Array.from({ length: 30 }, (_, i) => `Feature ${i} ${long}`),
        claims: Array.from({ length: 30 }, (_, i) => ({
          text: `Claim ${i}`,
          page: "homepage" as const,
        })),
      },
      null
    )

    expect(fields.name.length).toBeLessThanOrEqual(brandKitLimits.name)
    expect(fields.description.length).toBeLessThanOrEqual(
      brandKitLimits.description
    )
    expect(fields.features).toHaveLength(brandKitLimits.features)
    expect(fields.claims).toHaveLength(brandKitLimits.claims)
  })

  it("points pricing claims at the homepage when there was no pricing page", () => {
    const fields = toDraftFields(facts, ai, null)

    expect(fields.claims[1]?.sourceUrl).toBe("https://www.acme.app/")
  })
})
