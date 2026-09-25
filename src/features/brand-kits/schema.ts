import { z } from "zod"

/** Field limits, shared by validation and the editor's hints. */
export const brandKitLimits = {
  name: 60,
  description: 160,
  audience: 300,
  feature: 120,
  features: 12,
  pricingSummary: 300,
  claim: 200,
  claims: 20,
  bannedWord: 40,
  bannedWords: 50,
  font: 60,
  tone: 200,
  url: 2048,
} as const

const L = brandKitLimits

/**
 * A public website address. Accepts "yourapp.com" and adds https://.
 * Only http(s) and real hostnames; the fetcher (lib/fetch-page) also checks
 * where the name resolves before requesting it.
 */
export const websiteUrlSchema = z
  .string()
  .trim()
  .min(1, "Enter your app’s website address.")
  .max(L.url, "That address is too long.")
  .transform((value, ctx) => {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
      ? value
      : `https://${value}`
    let url: URL
    try {
      url = new URL(withScheme)
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a web address like yourapp.com.",
      })
      return z.NEVER
    }
    const isWeb = url.protocol === "https:" || url.protocol === "http:"
    const hasDomain = /^[^.]+(\.[^.]+)+$/.test(url.hostname)
    if (!isWeb || !hasDomain || url.username || url.password) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a public web address like yourapp.com.",
      })
      return z.NEVER
    }
    url.hash = ""
    return url.toString()
  })

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #18b26b.")
  .transform((value) => value.toLowerCase())

export const brandColorsSchema = z.object({
  primary: hexColor.optional(),
  secondary: hexColor.optional(),
  accent: hexColor.optional(),
})
export type BrandColors = z.infer<typeof brandColorsSchema>

const fontName = z
  .string()
  .trim()
  .max(L.font, `Keep font names under ${L.font} characters.`)
  .transform((value) => value || undefined)

export const brandFontsSchema = z.object({
  heading: fontName.optional(),
  body: fontName.optional(),
})
export type BrandFonts = z.infer<typeof brandFontsSchema>

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null)
    .nullable()

export const allowedClaimSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write the claim, or remove it.")
    .max(L.claim, `Keep each claim under ${L.claim} characters.`),
  sourceUrl: z
    .string()
    .trim()
    .max(L.url, "That link is too long.")
    .refine(
      (value) => value === "" || isHttpUrl(value),
      "Use a full link starting with https://."
    )
    .nullish()
    .transform((value) => value || null),
})
export type AllowedClaimInput = z.infer<typeof allowedClaimSchema>

/** Non-empty, trimmed, unique (case-insensitive) list items. */
const textList = (itemMax: number, listMax: number, noun: string) =>
  z
    .array(
      z
        .string()
        .trim()
        .max(itemMax, `Keep each ${noun} under ${itemMax} characters.`)
    )
    .transform((items) => {
      const seen = new Set<string>()
      return items.filter((item) => {
        const key = item.toLowerCase()
        if (!item || seen.has(key)) return false
        seen.add(key)
        return true
      })
    })
    .pipe(z.array(z.string()).max(listMax, `Add up to ${listMax} ${noun}s.`))

/** Every editable field of a brand kit (create and update). */
export const brandKitFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give this brand kit a name.")
    .max(L.name, `Keep the name under ${L.name} characters.`),
  url: websiteUrlSchema,
  description: z
    .string()
    .trim()
    .max(
      L.description,
      `Keep the description under ${L.description} characters.`
    ),
  audience: z
    .string()
    .trim()
    .max(L.audience, `Keep the audience under ${L.audience} characters.`),
  features: textList(L.feature, L.features, "feature"),
  pricingSummary: optionalText(
    L.pricingSummary,
    `Keep the pricing summary under ${L.pricingSummary} characters.`
  ),
  claims: z
    .array(allowedClaimSchema)
    .max(L.claims, `Add up to ${L.claims} claims.`),
  bannedWords: textList(L.bannedWord, L.bannedWords, "banned word"),
  colors: brandColorsSchema,
  fonts: brandFontsSchema,
  tone: optionalText(L.tone, `Keep the tone under ${L.tone} characters.`),
})
export type BrandKitFields = z.infer<typeof brandKitFieldsSchema>
export type BrandKitFieldsInput = z.input<typeof brandKitFieldsSchema>
