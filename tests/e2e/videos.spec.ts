import { copyFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { Page } from "@playwright/test"

import { expect, hasDatabase, test } from "./fixtures"
import { expectNoViolations } from "./helpers/axe"
import { createKitByHand } from "./helpers/brand-kits"
import { makeTestVideo } from "./helpers/video"

test.skip(
  !hasDatabase,
  "Signed-in tests need a database (DATABASE_URL_UNPOOLED)"
)

// Uploads go to a real bucket: Neon locally, the S3 server in CI.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

/** Two test clips: "Product demo" and "Feature tour". */
async function twoFiles() {
  const demo = await makeTestVideo()
  const tour = join(dirname(demo), "Feature tour.mp4")
  await copyFile(demo, tour)
  return { demo, tour }
}

const saved = (page: Page) => page.getByText("Saved", { exact: true })
const clips = (page: Page) =>
  page
    .getByRole("list", { name: "Clips in the video" })
    .getByTestId("project-clip")

test("a video: upload, edit it right away, add a clip, join, play, keep", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(240_000)
  const { demo, tour } = await twoFiles()
  await createKitByHand(page)

  // Start from the dashboard; the name can wait.
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "New video" }).click()
  await page.getByRole("button", { name: "Create video" }).click()
  await expect(page).toHaveURL(/\/videos\/[^/?]+$/, { timeout: 20_000 })
  await expect(
    page.getByRole("heading", { level: 1, name: "Untitled video" })
  ).toBeVisible()
  await expect(page.getByText("Add your first clip")).toBeVisible()
  await expectNoViolations(page)

  // Upload straight into the video: it processes, then the video opens in
  // the editor (one clip — no clip list in the way).
  await page.getByTestId("footage-file").setInputFiles(demo)
  await expect(page.getByText("Processing your clip")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page).toHaveURL(/\/footage\/[^/?]+\?video=/, {
    timeout: 90_000,
  })
  await expect(
    page.getByRole("heading", { level: 1, name: "Untitled video" })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: /Videos/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Delete clip" })).toHaveCount(0)

  // Another clip: its list opens, and the upload joins the video.
  await page.getByRole("link", { name: "Add clip" }).click()
  await expect(clips(page)).toHaveCount(1)
  await page.getByTestId("footage-file").setInputFiles(tour)
  await expect(clips(page)).toHaveCount(2, { timeout: 30_000 })
  await expect(clips(page).nth(1)).toContainText("Feature tour")
  // Both play as one video once the new one is processed: 5s + 5s.
  await expect(page.getByLabel("Playback position")).toHaveText(
    "0:00.0 / 0:10.0",
    { timeout: 90_000 }
  )
  await expect(saved(page)).toBeVisible()

  // A blur dissolve into the second overlaps them by 0.5s.
  await page.getByRole("combobox", { name: "Transition into clip 2" }).click()
  await page.getByRole("option", { name: "Blur dissolve" }).click()
  await expect(page.getByLabel("Playback position")).toHaveText(
    "0:00.0 / 0:09.5"
  )
  // Reorder: the tour first. The blur stays on the join between them.
  await page.getByRole("button", { name: "Move Feature tour earlier" }).click()
  await expect(clips(page).nth(0)).toContainText("Feature tour")
  await expect(
    page.getByRole("combobox", { name: "Transition into clip 2" })
  ).toHaveText(/Blur dissolve/)
  await expect(saved(page)).toBeVisible()
  await expectNoViolations(page)

  // It plays from start to end, through the join.
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expect(clips(page).nth(1)).toHaveAttribute("data-current", "true", {
    timeout: 15_000,
  })
  await expect(page.getByLabel("Playback position")).toHaveText(
    "0:09.5 / 0:09.5",
    { timeout: 15_000 }
  )

  // Kept after a reload (two clips: the clip list is the video's page).
  await page.goto(page.url().replace(/\?.*$/, ""))
  await expect(clips(page).nth(0)).toContainText("Feature tour")
  await expect(clips(page).nth(1)).toContainText("Product demo")
  await expect(
    page.getByRole("combobox", { name: "Transition into clip 2" })
  ).toHaveText(/Blur dissolve/)

  // Each clip is edited in the clip editor, which leads back here.
  await page.getByRole("link", { name: "Edit Product demo" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Product demo" })
  ).toBeVisible()
  await page.getByRole("link", { name: /Untitled video/ }).click()
  await expect(clips(page)).toHaveCount(2)

  // Renamed, it shows in Videos with its length…
  await page.getByRole("button", { name: "Rename video" }).click()
  await page.getByRole("textbox", { name: "Video name" }).fill("Launch cut")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch cut" })
  ).toBeVisible()
  await page
    .getByRole("link", { name: /videos/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/videos$/)
  const card = page.getByRole("list", { name: "Videos" }).getByRole("listitem")
  await expect(card).toContainText("Launch cut")
  await expect(card).toContainText("2 clips")
  // 9.5s, rounded like every length in the lists.
  await expect(card).toContainText("0:10")
  await expectNoViolations(page)

  // …and deletes from its card.
  await card.getByRole("button", { name: "Delete Launch cut" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete video" })
    .click()
  await expect(page.getByText("No videos yet")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("two tabs: a stale one is told to reload instead of overwriting", async ({
  page,
  context,
  signedInUser: _user,
}, info) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.skip(info.project.name === "mobile", "Two windows: desktop only")
  test.setTimeout(240_000)
  const { demo, tour } = await twoFiles()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  for (const file of [demo, tour]) {
    await page.getByTestId("footage-file").setInputFiles(file)
    await expect(page.getByText("Clip uploaded")).toBeVisible({
      timeout: 30_000,
    })
  }
  for (const name of ["Product demo", "Feature tour"]) {
    await expect(
      page.getByRole("listitem").filter({ hasText: name }).getByText("Ready")
    ).toBeVisible({ timeout: 60_000 })
  }

  // A video of both, chosen from the footage library.
  await page.goto("/videos")
  await page.getByRole("button", { name: "New video" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("Shared")
  await page.getByRole("button", { name: "Create video" }).click()
  await expect(page).toHaveURL(/\/videos\/[^/]+$/, { timeout: 20_000 })
  await page.getByRole("button", { name: "Choose from footage" }).click()
  const picker = page.getByRole("list", { name: "Footage to add" })
  await picker.getByRole("button", { name: /Product demo/ }).click()
  await picker.getByRole("button", { name: /Feature tour/ }).click()
  await page.getByRole("button", { name: "Add 2 clips" }).click()
  await expect(saved(page)).toBeVisible()
  await expect(clips(page)).toHaveCount(2)

  // A second tab removes a clip…
  const other = await context.newPage()
  await other.goto(page.url())
  await other
    .getByRole("button", { name: "Remove Feature tour from the video" })
    .click()
  await expect(saved(other)).toBeVisible()
  // …so the first tab's next change is refused, and it offers a reload.
  await page.getByRole("button", { name: "Move Feature tour earlier" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("This video changed somewhere else")
  await dialog.getByRole("button", { name: "Reload" }).click()
  // One clip left: the video opens in the editor.
  await expect(page).toHaveURL(/\/footage\/[^/?]+\?video=/, {
    timeout: 20_000,
  })

  // The same for a clip's own edit.
  await other.goto(page.url())
  const tools = (p: Page) => p.getByRole("tablist", { name: "Editor tools" })
  await tools(other).getByRole("tab", { name: "Style" }).click()
  await other.getByRole("button", { name: "Solid", exact: true }).click()
  await expect(saved(other)).toBeVisible()
  await tools(page).getByRole("tab", { name: "Style" }).click()
  await page.getByRole("button", { name: "Solid", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toContainText(
    "This clip changed somewhere else"
  )
  // Staying keeps the page, saving nothing more; Reload is at hand.
  await page.getByRole("button", { name: "Stay on this page" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(page.getByText("Not saved", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible()
})
