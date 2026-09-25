import { expect, hasDatabase, test } from "./fixtures"

test.skip(
  !hasDatabase,
  "Signed-in tests need a database (DATABASE_URL_UNPOOLED)"
)

// Stock presenters come from `prisma db seed` (run in CI after migrations).
const names = [
  "Maya",
  "Marcus",
  "Emma",
  "Diego",
  "Chloe",
  "Oliver",
  "Priya",
  "Sam",
]

test("the presenter library shows every stock presenter with a portrait", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, testInfo) => {
  await page.goto("/dashboard")
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  }
  await page
    .locator('[data-slot="sidebar"]')
    .last()
    .getByRole("link", { name: "Presenters" })
    .click()

  await expect(page).toHaveURL(/\/presenters$/)
  await expect(page).toHaveTitle("Presenters · ReelPilot")
  // Scoped to <main>: the sidebar's nav items are list items too.
  const cards = page.getByRole("main").getByRole("listitem")
  await expect(cards).toHaveCount(names.length)
  await expect(cards.locator('[data-slot="card-title"]')).toHaveText(names)
  // Portraits come from private storage through signed links.
  const maya = page.getByRole("img", { name: "Portrait of Maya" })
  await expect(maya).toBeVisible()
  await expect
    .poll(() => maya.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0)
  await expect(cards.first().getByText("Voice: Heart · American")).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(0)
  expect(consoleProblems).toEqual([])
})

test("voice samples play one at a time", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  await page.goto("/presenters")
  const maya = page.getByRole("button", { name: "Play Maya’s voice" })
  const emma = page.getByRole("button", { name: "Play Emma’s voice" })

  await maya.click()
  const mayaPlaying = page.getByRole("button", { name: "Pause Maya’s voice" })
  await expect(mayaPlaying).toHaveAttribute("aria-pressed", "true")

  // Starting another sample stops the first.
  await emma.click()
  await expect(
    page.getByRole("button", { name: "Pause Emma’s voice" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(maya).toHaveAttribute("aria-pressed", "false")

  await page.getByRole("button", { name: "Pause Emma’s voice" }).click()
  await expect(emma).toHaveAttribute("aria-pressed", "false")
  expect(consoleProblems).toEqual([])
})
