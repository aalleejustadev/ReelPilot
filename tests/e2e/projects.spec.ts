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

/** A kit with two processed clips, "Product demo" and "Feature tour". */
async function kitWithTwoClips(page: Page) {
  const demo = await makeTestVideo()
  const tour = join(dirname(demo), "Feature tour.mp4")
  await copyFile(demo, tour)
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
}

const saved = (page: Page) => page.getByText("Saved", { exact: true })
const clips = (page: Page) =>
  page
    .getByRole("list", { name: "Clips in the project" })
    .getByTestId("project-clip")

test("make a project from two clips, join them, play it through, keep it", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(240_000)
  await kitWithTwoClips(page)

  // Projects are on the dashboard and in the sidebar.
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "New project" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("Launch video")
  await page.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20_000 })
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch video" })
  ).toBeVisible()
  await expect(page.getByText("No clips yet")).toBeVisible()
  await expectNoViolations(page)

  // Pick both clips, in playing order.
  await page.getByRole("button", { name: "Add clips" }).click()
  const picker = page.getByRole("list", { name: "Footage to add" })
  await picker.getByRole("button", { name: /Product demo/ }).click()
  await picker.getByRole("button", { name: /Feature tour/ }).click()
  await page.getByRole("button", { name: "Add 2 clips" }).click()
  await expect(clips(page)).toHaveCount(2)
  await expect(clips(page).nth(0)).toContainText("Product demo")
  await expect(clips(page).nth(1)).toContainText("Feature tour")
  // Both play as one video once their media is in: 5s + 5s.
  await expect(page.getByLabel("Playback position")).toHaveText(
    "0:00.0 / 0:10.0",
    { timeout: 20_000 }
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
  await expect(
    page.getByRole("button", { name: "Play", exact: true })
  ).toBeVisible()

  // Kept after a reload: order and transition.
  await page.reload()
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
  await page.getByRole("link", { name: /Launch video/ }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch video" })
  ).toBeVisible()

  // Renamed, it shows in the list with its length.
  await page.getByRole("button", { name: "Rename project" }).click()
  await page.getByRole("textbox", { name: "Project name" }).fill("Launch cut")
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", { level: 1, name: "Launch cut" })
  ).toBeVisible()
  await page
    .getByRole("link", { name: /projects/i })
    .first()
    .click()
  await expect(page).toHaveURL(/\/projects$/)
  const card = page
    .getByRole("list", { name: "Projects" })
    .getByRole("listitem")
  await expect(card).toContainText("Launch cut")
  await expect(card).toContainText("2 clips")
  // 9.5s, rounded like every length in the lists.
  await expect(card).toContainText("0:10")
  await expectNoViolations(page)

  // Deleted from its page, it's gone.
  await card.getByRole("link", { name: "Launch cut" }).click()
  await page.getByRole("button", { name: "Delete project" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete project" })
    .click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByText("No projects yet")).toBeVisible()
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
  await kitWithTwoClips(page)

  // A project with both clips.
  await page.goto("/projects")
  await page.getByRole("button", { name: "New project" }).click()
  await page.getByRole("textbox", { name: "Name" }).fill("Shared")
  await page.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20_000 })
  await page.getByRole("button", { name: "Add clips" }).click()
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
    .getByRole("button", { name: "Remove Feature tour from the project" })
    .click()
  await expect(saved(other)).toBeVisible()
  // …so the first tab's next change is refused, and it offers a reload.
  await page.getByRole("button", { name: "Move Feature tour earlier" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("This project changed somewhere else")
  await dialog.getByRole("button", { name: "Reload" }).click()
  await expect(clips(page)).toHaveCount(1)
  await expect(clips(page).nth(0)).toContainText("Product demo")

  // The same for a clip's own edit.
  const clipUrl = await page
    .getByRole("link", { name: "Edit Product demo" })
    .getAttribute("href")
  await page.goto(clipUrl!)
  await other.goto(clipUrl!)
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
