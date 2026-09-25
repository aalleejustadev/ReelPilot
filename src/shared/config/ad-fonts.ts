/**
 * Fonts a brand kit can use in ads: widely used Google Fonts for social
 * video ads. Kits may only use these, so every ad can be rendered with the
 * exact font (Remotion loads them by name from M5). Order = menu order.
 */
export const adFonts = [
  { name: "Inter", category: "Sans serif", headingWeight: 700 },
  { name: "Montserrat", category: "Sans serif", headingWeight: 700 },
  { name: "Poppins", category: "Sans serif", headingWeight: 700 },
  { name: "Roboto", category: "Sans serif", headingWeight: 700 },
  { name: "Open Sans", category: "Sans serif", headingWeight: 700 },
  { name: "Lato", category: "Sans serif", headingWeight: 700 },
  { name: "DM Sans", category: "Sans serif", headingWeight: 700 },
  { name: "Nunito", category: "Sans serif", headingWeight: 700 },
  { name: "Raleway", category: "Sans serif", headingWeight: 700 },
  { name: "Rubik", category: "Sans serif", headingWeight: 700 },
  { name: "Oswald", category: "Display", headingWeight: 600 },
  // Single-weight display faces: bolding them would fake the weight.
  { name: "Bebas Neue", category: "Display", headingWeight: 400 },
  { name: "Anton", category: "Display", headingWeight: 400 },
  { name: "Archivo Black", category: "Display", headingWeight: 400 },
  { name: "Playfair Display", category: "Serif", headingWeight: 700 },
] as const

export type AdFontName = (typeof adFonts)[number]["name"]

const byLowerName = new Map<string, AdFontName>(
  adFonts.map((font) => [font.name.toLowerCase(), font.name])
)

/** The list's spelling of `name`, or null if it isn't an ad font. */
export function toAdFont(name: string): AdFontName | null {
  return byLowerName.get(name.trim().toLowerCase()) ?? null
}
