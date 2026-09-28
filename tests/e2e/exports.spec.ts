import type { Page } from "@playwright/test"

import { expect, hasDatabase, test } from "./fixtures"
import { expectNoViolations } from "./helpers/axe"
import { createKitByHand } from "./helpers/brand-kits"
import { makeTestVideo } from "./helpers/video"

test.skip(
  !hasDatabase,
  "Signed-in tests need a database (DATABASE_URL_UNPOOLED)"
)

// Uploads and exports go to a real bucket: Neon locally, the S3 server in CI.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

/** Uploads the test clip to a new kit and opens it in the clip editor. */
async function openUploadedClip(page: Page) {
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByTestId("footage-file").setInputFiles(video)
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 90_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Product demo" })
  ).toBeVisible()
}

test("export a clip as an MP4, share it, then turn sharing off", async ({
  page,
  browser,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(300_000)
  await openUploadedClip(page)

  await page.getByRole("button", { name: "Export" }).click()
  const dialog = page.getByRole("dialog", { name: "Export and share" })
  await expect(dialog.getByRole("button", { name: "Export MP4" })).toBeVisible()
  await expectNoViolations(page)

  // Portrait: rendered by the worker, with progress, then downloadable.
  await dialog.getByRole("button", { name: /Portrait/ }).click()
  await dialog.getByRole("button", { name: "Export MP4" }).click()
  await expect(dialog.getByRole("progressbar")).toBeVisible()
  const download = dialog.getByRole("link", { name: /Download MP4/ })
  await expect(download).toBeVisible({ timeout: 180_000 })
  // Up to date: nothing to export again.
  await expect(dialog.getByRole("button", { name: /Export/ })).toHaveCount(0)
  const file = page.waitForEvent("download")
  await download.click()
  expect((await file).suggestedFilename()).toBe("Product demo 9x16.mp4")

  // Another shape hasn't been exported yet.
  await dialog.getByRole("button", { name: /Square/ }).click()
  await expect(dialog.getByRole("button", { name: "Export MP4" })).toBeVisible()

  // Share: anyone with the link can watch, signed out.
  await dialog
    .getByRole("switch", { name: "Anyone with the link can watch" })
    .click()
  const link = dialog.getByRole("textbox", { name: "Share link" })
  await expect(link).toHaveValue(/\/v\/[\w-]+$/)
  const url = await link.inputValue()

  const visitor = await browser.newContext()
  const watch = await visitor.newPage()
  await watch.goto(url)
  await expect(
    watch.getByRole("heading", { level: 1, name: "Product demo" })
  ).toBeVisible()
  const player = watch.locator("video")
  await expect(player).toHaveAttribute("src", /\.mp4/)
  // It really plays: the browser reads the MP4's length (5s).
  await expect
    .poll(() => player.evaluate((el: HTMLVideoElement) => el.duration), {
      timeout: 20_000,
    })
    .toBeGreaterThan(4)
  await expectNoViolations(watch)

  // Off: the link stops working.
  await dialog
    .getByRole("switch", { name: "Anyone with the link can watch" })
    .click()
  await expect(link).toHaveCount(0)
  await watch.reload()
  await expect(watch.getByText("Page not found")).toBeVisible()
  await visitor.close()
  expect(consoleProblems).toEqual([])
})

test("an edit after exporting marks the export out of date", async ({
  page,
  signedInUser: _user,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(300_000)
  await openUploadedClip(page)

  const dialog = page.getByRole("dialog", { name: "Export and share" })
  await page.getByRole("button", { name: "Export" }).click()
  await dialog.getByRole("button", { name: "Export MP4" }).click()
  await expect(dialog.getByRole("link", { name: /Download MP4/ })).toBeVisible({
    timeout: 180_000,
  })
  await page.keyboard.press("Escape")

  // Any change to the edit: a camera shot on the moment at 2s.
  await page
    .getByRole("group", { name: "Timeline" })
    .getByRole("button", { name: /^Select the moment at 0:02\.\d/ })
    .click()
  await page.getByRole("button", { name: "Dramatic", exact: true }).click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Export" }).click()
  await expect(
    dialog.getByText("You’ve edited this since the last export.", {
      exact: false,
    })
  ).toBeVisible()
  // The old file still downloads; exporting again is offered.
  await expect(dialog.getByRole("link", { name: /Download MP4/ })).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: "Export again" })
  ).toBeVisible()
})

test("a video exports and shares as the video, from its editor", async ({
  page,
  browser,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(300_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "New video" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("Launch")
  await page.getByRole("button", { name: "Create video" }).click()
  await expect(page).toHaveURL(/\/videos\/[^/?]+$/, { timeout: 20_000 })
  // One clip: the video is edited in the clip editor.
  await page.getByTestId("footage-file").setInputFiles(video)
  await expect(page).toHaveURL(/\/footage\/[^/?]+\?video=/, {
    timeout: 90_000,
  })
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Export" }).click()
  const dialog = page.getByRole("dialog", { name: "Export and share" })
  await dialog.getByRole("button", { name: "Export MP4" }).click()
  const download = dialog.getByRole("link", { name: /Download MP4/ })
  await expect(download).toBeVisible({ timeout: 180_000 })
  const file = page.waitForEvent("download")
  await download.click()
  expect((await file).suggestedFilename()).toBe("Launch 16x9.mp4")

  await dialog
    .getByRole("switch", { name: "Anyone with the link can watch" })
    .click()
  const url = await dialog
    .getByRole("textbox", { name: "Share link" })
    .inputValue()
  const visitor = await browser.newContext()
  const watch = await visitor.newPage()
  await watch.goto(url)
  await expect(
    watch.getByRole("heading", { level: 1, name: "Launch" })
  ).toBeVisible()
  await expect(watch.locator("video")).toHaveAttribute("src", /\.mp4/)
  await visitor.close()

  // The video's own page (its clip list) shares the same state.
  await page.keyboard.press("Escape")
  await page.goto(
    page.url().replace(/\/brand-kits\/.*\?video=/, "/videos/") + "?clips=1"
  )
  await page.getByRole("button", { name: "Export" }).click()
  await expect(dialog.getByRole("link", { name: /Download MP4/ })).toBeVisible()
  await expect(dialog.getByRole("textbox", { name: "Share link" })).toHaveValue(
    url
  )
  expect(consoleProblems).toEqual([])
})
