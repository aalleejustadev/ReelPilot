import { expect, hasDatabase, test } from "./fixtures"
import { createKitByHand } from "./helpers/brand-kits"
import { makeTestVideo } from "./helpers/video"

test.skip(
  !hasDatabase,
  "Signed-in tests need a database (DATABASE_URL_UNPOOLED)"
)

// Uploads go to a real bucket: Neon locally, the S3 server in CI.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

test("a new kit points at its footage, one click away", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  // Before any kit, the Footage page sends people to make one.
  await page.goto("/footage")
  await expect(page.getByText("Start with your brand kit")).toBeVisible()

  await createKitByHand(page)
  await expect(page.getByText("Next: add your footage")).toBeVisible()
  await page.getByRole("link", { name: "Add footage" }).click()
  await expect(page).toHaveURL(/\/brand-kits\/[^/]+\/footage$/)
  await expect(page.getByRole("button", { name: "Upload video" })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("sidebar Footage: upload, open the editor, and come back", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, testInfo) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(150_000)
  const video = await makeTestVideo()
  await createKitByHand(page)

  // Straight from the sidebar (a sheet on phones).
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  }
  await page
    .locator('[data-slot="sidebar"]')
    .last()
    .getByRole("link", { name: "Footage" })
    .click()
  await expect(page).toHaveURL(/\/footage$/)
  await expect(page.getByText("No footage yet")).toBeVisible()

  // One kit: no picker, record or upload right here.
  await expect(page.getByRole("combobox", { name: "Brand kit" })).toHaveCount(0)
  await page.getByTestId("footage-file").setInputFiles(video)
  await expect(page.getByText("Clip uploaded")).toBeVisible({ timeout: 30_000 })
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })

  // Into the editor, and back to where it was opened from.
  await card.getByRole("link", { name: "Product demo" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Product demo" })
  ).toBeVisible()
  await page.getByRole("link", { name: /Footage|Back to Footage/ }).click()
  await expect(page).toHaveURL(/\/footage$/)
  await expect(card).toBeVisible()

  // The kit card counts it.
  await page.goto("/brand-kits")
  await expect(page.getByText("1 clip", { exact: true })).toBeVisible()
  expect(consoleProblems).toEqual([])
})
