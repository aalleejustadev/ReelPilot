import { expect, hasDatabase, test } from "./fixtures"
import { createKitByHand } from "./helpers/brand-kits"
import { makeTestVideo } from "./helpers/video"

test.skip(
  !hasDatabase,
  "Signed-in tests need a database (DATABASE_URL_UNPOOLED)"
)

// Uploads go to a real bucket: Neon locally, the S3 server in CI.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

test("footage tab starts empty and shows the plan's limits", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()

  await expect(page).toHaveURL(/\/footage$/)
  await expect(page.getByText("No footage yet")).toBeVisible()
  await expect(
    page.getByText(
      "0 of 5 clips on the Free plan, up to 200 MB and 3 minutes each."
    )
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Upload video" })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("the recorder explains what to do before capturing", async ({
  page,
  signedInUser: _user,
}) => {
  // Headless browsers can't capture a screen, so this covers the dialog;
  // the upload path it uses is tested below with a real file.
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByRole("button", { name: "Record your screen" }).click()

  const dialog = page.getByRole("dialog", { name: "Record your screen" })
  await expect(
    dialog.getByText("Up to 3 minutes. No sound is recorded")
  ).toBeVisible()
  await expect(
    dialog.getByText("Open your app in another tab or window first.")
  ).toBeVisible()
  await expect(
    dialog.getByRole("button", { name: "Start recording" })
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
})

test("a file that isn't a video is refused before uploading", async ({
  page,
  signedInUser: _user,
}) => {
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()

  await page.getByTestId("footage-file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  })

  await expect(
    page.getByText("Upload an MP4, MOV or WebM video.")
  ).toBeVisible()
})

test("upload a clip, let the worker process it, then edit its markers", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(120_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()

  await page.getByTestId("footage-file").setInputFiles(video)
  await expect(page.getByText("Clip uploaded")).toBeVisible({ timeout: 30_000 })

  // The worker converts it; the grid updates on its own.
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await expect(card.getByText("0:05")).toBeVisible()
  await card.getByRole("link", { name: "Product demo" }).click()

  await expect(
    page.getByRole("heading", { name: "Product demo" })
  ).toBeVisible()
  await expect(page.getByRole("tab", { name: "Footage" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  // The cut at 2s was found: on the timeline and in the list.
  await expect(
    page.getByRole("group", { name: "Timeline" }).getByRole("button", {
      name: /^Jump to 0:02\.\d$/,
    })
  ).toBeVisible()

  // Add a marker at the start, label it, then remove it.
  await page.getByRole("button", { name: /Add marker at 0:00\.0/ }).click()
  await expect(page.getByText("Marker added at 0:00.0")).toBeVisible()
  const label = page.getByRole("textbox", { name: "Label for 0:00.0" })
  await label.fill("Opening screen")
  await label.press("Enter")
  await page.reload()
  await expect(
    page.getByRole("textbox", { name: "Label for 0:00.0" })
  ).toHaveValue("Opening screen")
  await page.getByRole("button", { name: "Remove marker at 0:00.0" }).click()
  await expect(page.getByText("Marker at 0:00.0 removed")).toBeVisible()

  // Deleting the clip returns to an empty footage tab.
  await page.getByRole("button", { name: "Delete clip" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete clip" })
    .click()
  await expect(page).toHaveURL(/\/footage$/)
  await expect(page.getByText("No footage yet")).toBeVisible()
  expect(consoleProblems).toEqual([])
})
