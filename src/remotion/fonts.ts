import { adFonts, toAdFont, type AdFontName } from "@/shared/config/ad-fonts"

import type { StageFonts } from "./components/TextLayer"

/**
 * The stage's fonts from a brand kit's, given each font's CSS family name
 * (next/font's in the app, Fontsource's in renders).
 */
export function stageFontsWith(
  kitFonts: { heading?: string; body?: string },
  familyOf: Record<AdFontName, string>
): StageFonts {
  const heading = toAdFont(kitFonts.heading ?? "") ?? "Inter"
  const body = toAdFont(kitFonts.body ?? "") ?? heading
  return {
    heading: `${familyOf[heading]}, system-ui, sans-serif`,
    headingWeight:
      adFonts.find((font) => font.name === heading)?.headingWeight ?? 700,
    body: `${familyOf[body]}, system-ui, sans-serif`,
  }
}

/**
 * Each font's family in renders: the same Google Fonts, self-hosted from
 * Fontsource (loaded in ./Root.tsx). Variable where next/font loads the
 * variable font; Poppins and Lato at 400 and 700, as in the app.
 */
export const renderFontFamily: Record<AdFontName, string> = {
  Inter: "'Inter Variable'",
  Montserrat: "'Montserrat Variable'",
  Poppins: "'Poppins'",
  Roboto: "'Roboto Variable'",
  "Open Sans": "'Open Sans Variable'",
  Lato: "'Lato'",
  "DM Sans": "'DM Sans Variable'",
  Nunito: "'Nunito Variable'",
  Raleway: "'Raleway Variable'",
  Rubik: "'Rubik Variable'",
  Oswald: "'Oswald Variable'",
  "Bebas Neue": "'Bebas Neue'",
  Anton: "'Anton'",
  "Archivo Black": "'Archivo Black'",
  "Playfair Display": "'Playfair Display Variable'",
}
