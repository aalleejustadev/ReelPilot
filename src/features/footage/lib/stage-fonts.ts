import type { StageFonts } from "@/remotion/components/TextLayer"
import { adFonts, toAdFont } from "@/shared/config/ad-fonts"
import { adFontFamily } from "@/shared/lib/ad-font-faces"

/** The stage's fonts from a brand kit's (loaded by next/font). */
export function stageFontsFor(kitFonts: {
  heading?: string
  body?: string
}): StageFonts {
  const heading = toAdFont(kitFonts.heading ?? "") ?? "Inter"
  const body = toAdFont(kitFonts.body ?? "") ?? heading
  return {
    heading: `${adFontFamily[heading]}, system-ui, sans-serif`,
    headingWeight:
      adFonts.find((font) => font.name === heading)?.headingWeight ?? 700,
    body: `${adFontFamily[body]}, system-ui, sans-serif`,
  }
}
