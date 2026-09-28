import type { StageFonts } from "@/remotion/components/TextLayer"
import { stageFontsWith } from "@/remotion/fonts"
import { adFontFamily } from "@/shared/lib/ad-font-faces"

/** The stage's fonts from a brand kit's (loaded by next/font). */
export function stageFontsFor(kitFonts: {
  heading?: string
  body?: string
}): StageFonts {
  return stageFontsWith(kitFonts, adFontFamily)
}
