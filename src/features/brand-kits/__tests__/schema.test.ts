import { describe, expect, it } from "vitest"

import {
  brandKitFieldsSchema,
  brandKitLimits,
  websiteUrlSchema,
  type BrandKitFieldsInput,
} from "../schema"

const validFields: BrandKitFieldsInput = {
  name: "ReelPilot",
  url: "https://reelpilot.app",
  description: "Video ads from your real product footage.",
  audience: "SaaS founders running paid social",
  features: ["Script matrix", "Compliance guard"],
  pricingSummary: "Free plan, paid from $29/month",
  claims: [{ text: "Ads in minutes", sourceUrl: "https://reelpilot.app" }],
  bannedWords: ["guaranteed"],
  colors: { primary: "#18B26B" },
  fonts: { heading: "Inter" },
  tone: "Plain and confident",
}

const messagesFor = (input: unknown) =>
  brandKitFieldsSchema.safeParse(input).error?.issues.map((i) => i.message)

describe("websiteUrlSchema", () => {
  it.each([
    ["yourapp.com", "https://yourapp.com/"],
    ["  https://yourapp.com/pricing#top ", "https://yourapp.com/pricing"],
    ["http://www.yourapp.co.uk", "http://www.yourapp.co.uk/"],
  ])("normalizes %j", (input, expected) => {
    expect(websiteUrlSchema.parse(input)).toBe(expected)
  })

  it.each([
    "",
    "localhost",
    "http://localhost:3000",
    "ftp://yourapp.com",
    "javascript:alert(1)",
    "https://user:pass@yourapp.com",
    "not a url",
  ])("rejects %j", (input) => {
    expect(websiteUrlSchema.safeParse(input).success).toBe(false)
  })
})

describe("brandKitFieldsSchema", () => {
  it("accepts a complete kit and normalizes it", () => {
    const parsed = brandKitFieldsSchema.parse(validFields)

    expect(parsed.url).toBe("https://reelpilot.app/")
    expect(parsed.colors.primary).toBe("#18b26b")
  })

  it("trims list items and drops blanks and case-insensitive duplicates", () => {
    const parsed = brandKitFieldsSchema.parse({
      ...validFields,
      features: [" Script matrix ", "", "script matrix", "Previews"],
    })

    expect(parsed.features).toEqual(["Script matrix", "Previews"])
  })

  it("stores empty optional text as null", () => {
    const parsed = brandKitFieldsSchema.parse({
      ...validFields,
      pricingSummary: "  ",
      tone: "",
      claims: [{ text: "Ads in minutes", sourceUrl: "" }],
    })

    expect(parsed.pricingSummary).toBeNull()
    expect(parsed.tone).toBeNull()
    expect(parsed.claims[0]?.sourceUrl).toBeNull()
  })

  it("requires a name", () => {
    expect(messagesFor({ ...validFields, name: " " })).toContain(
      "Give this brand kit a name."
    )
  })

  it("rejects a claim source that isn't an http(s) link", () => {
    expect(
      messagesFor({
        ...validFields,
        claims: [{ text: "Fast", sourceUrl: "javascript:alert(1)" }],
      })
    ).toContain("Use a full link starting with https://.")
  })

  it("rejects bad colours", () => {
    expect(
      messagesFor({ ...validFields, colors: { primary: "green" } })
    ).toContain("Use a hex colour like #18b26b.")
  })

  it("caps list lengths", () => {
    const tooMany = Array.from(
      { length: brandKitLimits.claims + 1 },
      (_, i) => ({ text: `Claim ${i}` })
    )

    expect(messagesFor({ ...validFields, claims: tooMany })).toContain(
      `Add up to ${brandKitLimits.claims} claims.`
    )
  })

  it("stores fonts in the list's spelling and rejects fonts ads can't use", () => {
    expect(
      brandKitFieldsSchema.parse({
        ...validFields,
        fonts: { heading: " bebas neue ", body: "" },
      }).fonts
    ).toEqual({ heading: "Bebas Neue", body: undefined })
    expect(
      messagesFor({ ...validFields, fonts: { heading: "Comic Sans MS" } })
    ).toContain("Choose a font from the list.")
  })
})
