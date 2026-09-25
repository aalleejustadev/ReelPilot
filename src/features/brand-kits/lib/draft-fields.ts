import { z } from "zod"

import {
  brandKitFieldsSchema,
  brandKitLimits as L,
  type BrandKitFields,
} from "../schema"
import type { PageFacts } from "./read-page"

/**
 * What the AI fills in. No length limits here (not every provider's
 * structured output supports them); toDraftFields clips to brandKitLimits.
 */
export const aiDraftSchema = z.object({
  name: z.string().describe("The product's name, as the site writes it."),
  description: z
    .string()
    .describe(
      `One sentence under ${L.description} characters: what it does and for whom.`
    ),
  audience: z
    .string()
    .describe("Who it's for, e.g. 'Solo SaaS founders running paid social'."),
  features: z
    .array(z.string())
    .describe(`Up to ${L.features} key features, a few words each.`),
  pricingSummary: z
    .string()
    .nullable()
    .describe("Plans and prices in one or two sentences, or null if unknown."),
  claims: z
    .array(
      z.object({
        text: z.string().describe("The claim, worded as the page words it."),
        page: z.enum(["homepage", "pricing"]),
      })
    )
    .describe(
      "Claims the site makes about results, speed, scale or guarantees. Not plan limits."
    ),
  tone: z
    .string()
    .describe("The brand's voice in a few words, e.g. 'Friendly, plain'."),
})
export type AiDraft = z.infer<typeof aiDraftSchema>

/** Cuts text to `max` characters at the last word boundary (never mid-word, unless it's one long word). */
export function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > 0 ? cut.slice(0, space) : cut).trim()
}

/** "Acme — Invoices on autopilot" → "Acme"; falls back to the hostname. */
export function fallbackName(facts: PageFacts) {
  const fromTitle = facts.title?.split(/\s+[|–—·:-]\s+/)[0]
  const host = new URL(facts.url).hostname.replace(/^www\./, "")
  return clip(facts.siteName ?? fromTitle ?? host, L.name) || host
}

/**
 * Combines page facts with the AI's draft (or null if it failed) into
 * valid kit fields. Colours, fonts and logo come from the page itself.
 */
export function toDraftFields(
  facts: PageFacts,
  ai: AiDraft | null,
  pricingUrl: string | null
): BrandKitFields {
  const [primary, secondary, accent] = facts.colors
  const [headingFont, bodyFont] = facts.fonts

  return brandKitFieldsSchema.parse({
    name: clip(ai?.name ?? "", L.name) || fallbackName(facts),
    url: facts.url,
    description: clip(
      ai?.description || facts.description || "",
      L.description
    ),
    audience: clip(ai?.audience ?? "", L.audience),
    features: (ai?.features ?? [])
      .map((feature) => clip(feature, L.feature))
      .slice(0, L.features),
    pricingSummary: ai?.pricingSummary
      ? clip(ai.pricingSummary, L.pricingSummary)
      : null,
    claims: (ai?.claims ?? [])
      .map((claim) => ({
        text: clip(claim.text, L.claim),
        sourceUrl:
          claim.page === "pricing" && pricingUrl ? pricingUrl : facts.url,
      }))
      .filter((claim) => claim.text)
      .slice(0, L.claims),
    bannedWords: [],
    colors: { primary, secondary, accent },
    fonts: { heading: headingFont, body: bodyFont ?? headingFont },
    tone: ai?.tone ? clip(ai.tone, L.tone) : null,
  })
}

/** An empty kit for `url`, for when the user fills it in themselves. */
export function blankFields(url: string): BrandKitFields {
  const host = new URL(url).hostname.replace(/^www\./, "")
  return brandKitFieldsSchema.parse({
    name: clip(host, L.name),
    url,
    description: "",
    audience: "",
    features: [],
    pricingSummary: null,
    claims: [],
    bannedWords: [],
    colors: {},
    fonts: {},
    tone: null,
  })
}
