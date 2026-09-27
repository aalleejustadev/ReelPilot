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

test("upload a clip, let the worker process it, then edit it in the editor", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(150_000)
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

  // The full-screen editor: no app sidebar, the clip's name in its top bar.
  await expect(
    page.getByRole("heading", { level: 1, name: "Product demo" })
  ).toBeVisible()
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0)
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const timeline = page.getByRole("group", { name: "Timeline" })
  const saved = page.getByText("Saved", { exact: true })

  // The cut at 2s was found. Selecting it opens its shot.
  await timeline
    .getByRole("button", { name: /^Select the moment at 0:02\.\d/ })
    .click()
  await expect(tools.getByRole("tab", { name: "Shot" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await page.getByRole("button", { name: "Dramatic", exact: true }).click()
  await expect(saved).toBeVisible()
  // The 3D stage shows the shot: the frame is turned, not flat.
  await expect
    .poll(() =>
      page
        .getByTestId("motion-stage")
        .locator(".will-change-transform")
        .evaluate((el) => (el as HTMLElement).style.transform)
    )
    .toContain("rotateY(-34deg)")
  await tools.getByRole("tab", { name: "Style" }).click()
  await page.getByRole("button", { name: "Solid", exact: true }).click()
  await expect(saved).toBeVisible()

  // Both survive a reload.
  await page.reload()
  await timeline.getByRole("button", { name: /camera set/ }).click()
  await expect(
    page.getByRole("button", { name: "Dramatic", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expectNoViolations(page)

  // Drag the playhead to 60% of the 5s clip, then nudge it with the keyboard.
  const box = await timeline.boundingBox()
  if (!box) throw new Error("Timeline not visible")
  const middleY = box.y + box.height / 2
  await page.mouse.move(box.x + 4, middleY)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, middleY, { steps: 6 })
  await page.mouse.up()
  const playhead = page.getByRole("slider", { name: "Playhead" })
  await expect(playhead).toHaveAttribute("aria-valuetext", /^0:0(2\.9|3\.\d)$/)
  const before = Number(await playhead.getAttribute("aria-valuenow"))
  await playhead.press("ArrowRight")
  await expect(playhead).toHaveAttribute("aria-valuenow", String(before + 100))

  // Play from there; Stop returns to the start.
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Pause", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Stop" }).click()
  await expect(playhead).toHaveAttribute("aria-valuetext", "0:00.0")

  // Each key moment can take its own shot right in the Moments list.
  await tools.getByRole("tab", { name: "Moments" }).click()
  const shotSelect = page.getByRole("combobox", {
    name: /^Camera shot at 0:02/,
  })
  await shotSelect.click()
  await page.getByRole("option", { name: "Tilt left" }).click()
  await expect(shotSelect).toContainText("Tilt left")
  await expect(saved).toBeVisible()

  // ⌘Z / Ctrl+Z undoes it; Redo brings it back.
  await playhead.focus()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(shotSelect).toContainText("Dramatic")
  await page.getByRole("button", { name: /^Redo/ }).click()
  await expect(shotSelect).toContainText("Tilt left")

  // One click on a look styles every moment; the Undo button reverts it.
  await tools.getByRole("tab", { name: "Effects" }).click()
  await page.getByRole("button", { name: /^Showcase/ }).click()
  await tools.getByRole("tab", { name: "Moments" }).click()
  await expect(shotSelect).toContainText("Orbit left")
  await page.getByRole("button", { name: /^Undo/ }).click()
  await expect(shotSelect).toContainText("Tilt left")
  await expect(saved).toBeVisible()

  // Ready-made AI prompts fill the instruction.
  await tools.getByRole("tab", { name: "AI", exact: true }).click()
  await page.getByRole("button", { name: "Feature tour" }).click()
  await expect(
    page.getByRole("textbox", { name: "Describe the motion" })
  ).toHaveValue(/^Zoom into each key moment/)

  // Add a moment at the start, label it, then remove it.
  await page.getByRole("button", { name: "Stop" }).click()
  await page.getByRole("button", { name: /Add marker at 0:00\.0/ }).click()
  await expect(page.getByText("Marker added at 0:00.0")).toBeVisible()
  await tools.getByRole("tab", { name: "Moments" }).click()
  const label = page.getByRole("textbox", { name: "Label for 0:00.0" })
  await label.fill("Opening screen")
  await label.press("Enter")
  await page.reload()
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Moments" })
    .click()
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

test("playback keeps going through saves and refreshes to the very end", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  // Regression (2026-09-27): after a save, the server refresh re-rendered
  // server-built header elements as undefined inside the editor, which
  // crashed it and froze the page mid-playback.
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(150_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByTestId("footage-file").setInputFiles(video)
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const player = page.locator("video")
  const state = () =>
    player.evaluate((v: HTMLVideoElement) => ({
      paused: v.paused,
      ended: v.ended,
      t: v.currentTime,
    }))

  // A look saves every moment; wait out the saves while paused.
  await page.getByRole("button", { name: /^Showcase/ }).click()
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await page
    .getByRole("group", { name: "Timeline" })
    .getByRole("button", { name: /^Select the moment/ })
    .first()
    .click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await page.waitForTimeout(2500)

  // Play from the selected moment; add a moment mid-play (that refreshes
  // the page); it still plays to the end.
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByRole("button", { name: /^Add marker at/ }).click()
  await expect(page.getByText(/^Marker added at/)).toBeVisible()
  await expect
    .poll(async () => (await state()).ended, { timeout: 10_000 })
    .toBe(true)
  expect((await state()).t).toBeGreaterThan(4.9)
  expect(consoleProblems).toEqual([])
})
