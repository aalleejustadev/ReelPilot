import { parse, type HTMLElement } from "node-html-parser"

/** What we can learn about a product from one HTML page, before any AI. */
export type PageFacts = {
  url: string
  title: string | null
  description: string | null
  siteName: string | null
  /** Visible text, whitespace-collapsed and capped at `maxTextLength`. */
  text: string
  /** Hex colours, most likely brand colour first. */
  colors: string[]
  /** Font family names, most used first. */
  fonts: string[]
  /** Absolute URLs of likely logo images, best first. */
  logoUrls: string[]
  /** Same-site pricing page, if the page links to one. */
  pricingUrl: string | null
}

const maxTextLength = 12_000
const maxCandidates = 5

const genericFonts = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "-apple-system",
  "blinkmacsystemfont",
  "inherit",
  "initial",
  "unset",
  "revert",
])

function clean(value: string | undefined | null) {
  const text = value?.replace(/\s+/g, " ").trim()
  return text || null
}

function meta(root: HTMLElement, ...names: string[]) {
  for (const name of names) {
    const el =
      root.querySelector(`meta[property="${name}"]`) ??
      root.querySelector(`meta[name="${name}"]`)
    const content = clean(el?.getAttribute("content"))
    if (content) return content
  }
  return null
}

function absoluteHttpUrl(href: string | undefined, base: string) {
  if (!href) return null
  try {
    const url = new URL(href.trim(), base)
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}

/** Counts items and returns them most frequent first (ties keep first-seen order). */
function byFrequency(items: string[]) {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([item]) => item)
}

function normalizeHex(value: string) {
  const hex = value.toLowerCase()
  if (hex.length === 4) {
    return `#${[...hex.slice(1)].map((c) => c + c).join("")}`
  }
  return hex.slice(0, 7)
}

/** Greys, near-white and near-black are layout colours, not brand colours. */
function isColourful(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  return max - min > 40 && max > 40 && min < 235
}

function readColors(root: HTMLElement, css: string) {
  const themeColor = meta(root, "theme-color", "msapplication-TileColor")
  const declared =
    themeColor && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(themeColor)
      ? [normalizeHex(themeColor)]
      : []
  const found = (css.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? [])
    .map(normalizeHex)
    .filter(isColourful)
  return [...new Set([...declared, ...byFrequency(found)])].slice(
    0,
    maxCandidates
  )
}

/** "__Inter_d65c78" (next/font) → "Inter"; quotes and fallbacks removed. */
function fontFamilyName(declaration: string) {
  const first = declaration
    .split(",")[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, "")
  if (!first || first.startsWith("var(")) return null
  const name = first.replace(/^__(.+?)(_Fallback)?_[a-f0-9]{4,}$/i, "$1")
  const readable = name.replace(/_/g, " ").trim()
  if (!readable || genericFonts.has(readable.toLowerCase())) return null
  return readable
}

function readFonts(root: HTMLElement, css: string) {
  const googleFamilies = root
    .querySelectorAll('link[href*="fonts.googleapis.com"]')
    .flatMap((link) => {
      try {
        const url = new URL(link.getAttribute("href") ?? "", "https://x")
        return url.searchParams
          .getAll("family")
          .flatMap((family) => family.split("|"))
          .map((family) =>
            (family.split(":")[0] ?? "").replace(/\+/g, " ").trim()
          )
      } catch {
        return []
      }
    })
  const declared = [...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)]
    .map((match) => fontFamilyName(match[1] ?? ""))
    .filter((name): name is string => Boolean(name))
  return [...new Set([...googleFamilies, ...byFrequency(declared)])]
    .filter(Boolean)
    .slice(0, maxCandidates)
}

function jsonLdLogos(root: HTMLElement): string[] {
  const logos: string[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== "object") return
    const node = value as Record<string, unknown>
    const logo = node.logo
    if (typeof logo === "string") logos.push(logo)
    else if (logo && typeof logo === "object" && "url" in logo) {
      const url = (logo as { url?: unknown }).url
      if (typeof url === "string") logos.push(url)
    }
    if (node["@graph"]) visit(node["@graph"])
  }
  for (const script of root.querySelectorAll(
    'script[type="application/ld+json"]'
  )) {
    try {
      visit(JSON.parse(script.text))
    } catch {
      // Malformed structured data is common; ignore it.
    }
  }
  return logos
}

function readLogoUrls(root: HTMLElement, base: string) {
  const iconSize = (el: HTMLElement) =>
    Number(el.getAttribute("sizes")?.split("x")[0]) || 0
  const icons = root
    .querySelectorAll("link[rel][href]")
    .filter((el) =>
      /(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(el.getAttribute("rel") ?? "")
    )
    .sort((a, b) => {
      const touch = (el: HTMLElement) =>
        /apple-touch-icon/i.test(el.getAttribute("rel") ?? "") ? 1 : 0
      return touch(b) - touch(a) || iconSize(b) - iconSize(a)
    })
    .map((el) => el.getAttribute("href"))

  const logoImages = root
    .querySelectorAll("header img[src], nav img[src], img[src]")
    .filter((img) =>
      /logo/i.test(
        [
          img.getAttribute("alt"),
          img.getAttribute("class"),
          img.getAttribute("src"),
        ]
          .filter(Boolean)
          .join(" ")
      )
    )
    .map((img) => img.getAttribute("src"))

  const candidates = [...jsonLdLogos(root), ...logoImages, ...icons]
    .map((href) => absoluteHttpUrl(href ?? undefined, base))
    .filter((url): url is string => Boolean(url))
  return [...new Set(candidates)].slice(0, maxCandidates)
}

function readPricingUrl(root: HTMLElement, base: string) {
  const origin = new URL(base).origin
  for (const link of root.querySelectorAll("a[href]")) {
    const href = absoluteHttpUrl(link.getAttribute("href"), base)
    if (!href) continue
    const url = new URL(href)
    url.hash = ""
    if (url.origin !== origin || url.toString() === base) continue
    if (/\b(pricing|plans)\b/i.test(`${url.pathname} ${link.text}`)) {
      return url.toString()
    }
  }
  return null
}

/** Reads a page's metadata, visible text and brand hints. Never throws. */
export function readPage(html: string, url: string): PageFacts {
  const root = parse(html)
  const base =
    absoluteHttpUrl(
      root.querySelector("base[href]")?.getAttribute("href"),
      url
    ) ?? url

  const css = [
    ...root.querySelectorAll("style").map((el) => el.text),
    ...root
      .querySelectorAll("[style]")
      .map((el) => el.getAttribute("style") ?? ""),
  ].join("\n")

  const facts = {
    url,
    title: clean(root.querySelector("title")?.text),
    description: meta(root, "description", "og:description"),
    siteName: meta(root, "og:site_name", "application-name"),
    colors: readColors(root, css),
    fonts: readFonts(root, css),
    logoUrls: readLogoUrls(root, base),
    pricingUrl: readPricingUrl(root, base),
  }

  for (const el of root.querySelectorAll(
    "script, style, noscript, template, svg, iframe, canvas"
  )) {
    el.remove()
  }
  const body = root.querySelector("body") ?? root
  const text = body.structuredText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxTextLength)

  return { ...facts, text }
}
