import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

// Reads the real token values so a colour tweak that breaks WCAG AA fails CI.
const css = readFileSync(join(__dirname, "../globals.css"), "utf8")

function token(name: string): [number, number, number] {
  const match = css.match(
    new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`)
  )
  if (!match) throw new Error(`Token --${name} not found as oklch()`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** OKLCH → relative luminance (WCAG 2.x). */
function luminance([l, c, h]: [number, number, number]) {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const r = clamp(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S)
  const g = clamp(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S)
  const bl = clamp(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

function contrast(fg: string, bg: string) {
  const [x, y] = [luminance(token(fg)), luminance(token(bg))].sort(
    (p, q) => q - p
  )
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background, what uses it]
const textPairs = [
  ["ink", "stage", "body text on the app background"],
  ["ink", "surface", "body text on panels"],
  ["slate", "stage", "secondary text on the app background"],
  ["slate", "surface", "secondary text on panels"],
  ["slate", "well", "muted text on tab tracks and hovers"],
  ["ink", "well", "text on tab tracks and hovers"],
  ["surface", "ink", "primary button"],
  ["tally-strong", "surface", "destructive text, field errors"],
  ["tally-strong", "stage", "error text on the app background"],
  ["surface", "projector", "captions on video frames"],
] as const

// Focus rings and other non-text UI need 3:1 (WCAG 1.4.11).
const uiPairs = [
  ["chroma-strong", "surface", "focus ring on panels"],
  ["chroma-strong", "stage", "focus ring on the app background"],
] as const

describe("colour contrast (WCAG AA)", () => {
  it.each(textPairs)("%s on %s ≥ 4.5:1 (%s)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(uiPairs)("%s on %s ≥ 3:1 (%s)", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3)
  })
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === "generated" || name === "__tests__") return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

describe("chroma usage", () => {
  it("never uses plain chroma as a text colour (2.8:1 on white)", () => {
    const srcDir = join(__dirname, "../../..")
    const offenders = sourceFiles(srcDir).filter((file) =>
      /\btext-chroma(?![-\w])/.test(readFileSync(file, "utf8"))
    )

    expect(offenders).toEqual([])
  })
})
