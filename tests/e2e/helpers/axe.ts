import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

// WCAG 2.2 A and AA (build plan §14.1: accessible).
const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

export async function expectNoViolations(page: Page) {
  // Scan settled UI: mid-fade toasts and dialogs are partly transparent,
  // which axe reports as low contrast.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running")
  )
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`
  )
  expect(summary).toEqual([])
}
