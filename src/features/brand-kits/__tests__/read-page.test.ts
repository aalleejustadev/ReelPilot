import { describe, expect, it } from "vitest"

import { readPage } from "../lib/read-page"

const url = "https://acme.app/"

const page = `<!doctype html>
<html>
<head>
  <title>Acme — Invoices on autopilot</title>
  <meta name="description" content="Acme sends and chases invoices for freelancers.">
  <meta property="og:site_name" content="Acme">
  <meta name="theme-color" content="#FF5A1F">
  <link rel="icon" href="/favicon-32.png" sizes="32x32">
  <link rel="icon" href="/favicon-192.png" sizes="192x192">
  <link rel="apple-touch-icon" href="/apple-touch.png">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter&display=swap" rel="stylesheet">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","logo":{"url":"/brand/logo.png"}}]}</script>
  <script type="application/ld+json">{ not json</script>
  <style>
    body { color: #111111; background: #ffffff; font-family: '__Inter_d65c78', '__Inter_Fallback_d65c78', sans-serif; }
    .btn { background: #2F6BFF; border-color: #2f6bff; }
    .muted { color: #6b7280; }
    .badge { color: #2F6BFF; }
    .hl { color: #f0a; }
    h1 { font-family: var(--font-display), serif; }
  </style>
  <script>window.secret = "do not read"</script>
</head>
<body>
  <header><nav>
    <img src="/img/acme-logo.png" alt="Acme logo">
    <a href="/pricing#plans">Pricing</a>
    <a href="https://other.example/pricing">Partner pricing</a>
  </nav></header>
  <main>
    <h1>Invoices   that chase themselves</h1>
    <p>Get paid 2x faster.</p>
    <noscript>Enable JavaScript</noscript>
    <svg><text>ignored svg text</text></svg>
  </main>
</body>
</html>`

describe("readPage", () => {
  const facts = readPage(page, url)

  it("reads title, description and site name", () => {
    expect(facts).toMatchObject({
      url,
      title: "Acme — Invoices on autopilot",
      description: "Acme sends and chases invoices for freelancers.",
      siteName: "Acme",
    })
  })

  it("puts the theme colour first, then colourful CSS colours by use", () => {
    expect(facts.colors).toEqual(["#ff5a1f", "#2f6bff", "#ff00aa"])
  })

  it("finds Google Fonts families and next/font names", () => {
    expect(facts.fonts).toEqual(["Space Grotesk", "Inter"])
  })

  it("ranks logo candidates: structured data, logo images, then icons", () => {
    expect(facts.logoUrls).toEqual([
      "https://acme.app/brand/logo.png",
      "https://acme.app/img/acme-logo.png",
      "https://acme.app/apple-touch.png",
      "https://acme.app/favicon-192.png",
      "https://acme.app/favicon-32.png",
    ])
  })

  it("finds a same-site pricing page only", () => {
    expect(facts.pricingUrl).toBe("https://acme.app/pricing")
  })

  it("keeps visible text and drops scripts, styles, noscript and svg", () => {
    expect(facts.text).toContain("Invoices that chase themselves")
    expect(facts.text).toContain("Get paid 2x faster.")
    expect(facts.text).not.toMatch(
      /secret|Enable JavaScript|ignored svg|color:/
    )
  })

  it("resolves links against <base href>", () => {
    const withBase = readPage(
      `<head><base href="https://cdn.acme.app/site/"><link rel="icon" href="icon.png"></head>`,
      url
    )

    expect(withBase.logoUrls).toEqual(["https://cdn.acme.app/site/icon.png"])
  })

  it("copes with an empty page", () => {
    expect(readPage("", url)).toEqual({
      url,
      title: null,
      description: null,
      siteName: null,
      text: "",
      colors: [],
      fonts: [],
      logoUrls: [],
      pricingUrl: null,
    })
  })

  it("ignores javascript: and data: links", () => {
    const facts = readPage(
      `<link rel="icon" href="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AAAA"><a href="javascript:void(0)">Pricing</a>`,
      url
    )

    expect(facts.logoUrls).toEqual([])
    expect(facts.pricingUrl).toBeNull()
  })
})
