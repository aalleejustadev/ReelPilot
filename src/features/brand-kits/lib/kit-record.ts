import {
  brandColorsSchema,
  brandFontsSchema,
  type AllowedClaimInput,
  type BrandColors,
  type BrandFonts,
  type BrandKitFields,
} from "../schema"

/** Scalar columns for a create or update, from validated fields. */
export function toKitColumns(fields: BrandKitFields) {
  const { claims: _claims, ...columns } = fields
  return columns
}

/** Claim rows in editor order. */
export function toClaimRows(claims: AllowedClaimInput[]) {
  return claims.map((claim, position) => ({
    position,
    text: claim.text,
    sourceUrl: claim.sourceUrl,
  }))
}

/** Stored JSON is only ever written from validated input; fall back to empty. */
export function parseStoredColors(value: unknown): BrandColors {
  return brandColorsSchema.safeParse(value).data ?? {}
}

export function parseStoredFonts(value: unknown): BrandFonts {
  return brandFontsSchema.safeParse(value).data ?? {}
}
