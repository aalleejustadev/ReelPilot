import type { Locator } from "@playwright/test"

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
  await expect(tools.getByRole("tab", { name: "Camera" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await page.getByRole("button", { name: "Dramatic", exact: true }).click()
  await expect(saved).toBeVisible()
  // The 3D stage shows the shot: the frame has (just about) landed on
  // Dramatic's -34° turn; the camera's spring finishes the last 2%.
  await expect
    .poll(async () => {
      const transform = await page
        .getByTestId("camera-frame")
        .evaluate((el) => (el as HTMLElement).style.transform)
      return Number(/rotateY\((-?[\d.]+)deg\)/.exec(transform)?.[1])
    })
    .toBeLessThan(-32.5)
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

  // The smart analysis ran after processing (AI vision is off in tests):
  // the still colour bars from 2s are marked as a stretch where nothing
  // changes.
  await tools.getByRole("tab", { name: "Moments" }).click()
  await expect(
    page.getByText("Analysed: the camera can aim at where things happen.")
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId("idle-range")).toHaveCount(1)
  await expect(
    page.getByRole("button", { name: "Analyse again" })
  ).toBeVisible()
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

  // One click on a look styles every moment; "New take" redraws it (here
  // mirrored); the Undo button steps back through both.
  await tools.getByRole("tab", { name: "Looks" }).click()
  await page.getByRole("button", { name: /^Isometric/ }).click()
  await expect(
    page.getByRole("button", { name: /^Isometric/ })
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "New take" }).click()
  await expect(page.getByText("Isometric, take 2.")).toBeVisible()
  await tools.getByRole("tab", { name: "Moments" }).click()
  await expect(shotSelect).toContainText("Isometric right")
  await page.getByRole("button", { name: /^Undo/ }).click()
  await expect(shotSelect).toContainText("Isometric")
  await page.getByRole("button", { name: /^Undo/ }).click()
  await expect(shotSelect).toContainText("Tilt left")
  await expect(saved).toBeVisible()

  // Ready-made AI prompts fill the instruction.
  await tools.getByRole("tab", { name: "AI", exact: true }).click()
  await page.getByRole("button", { name: "Feature tour" }).click()
  await expect(
    page.getByRole("textbox", { name: "Describe the ad" })
  ).toHaveValue(/^A clear, calm feature tour/)

  // Add a moment at the start, label it, then remove it.
  await page.getByRole("button", { name: "Stop" }).click()
  await page.getByRole("button", { name: /Add marker at 0:00\.0/ }).click()
  await expect(page.getByText("Marker added at 0:00.0")).toBeVisible()
  await tools.getByRole("tab", { name: "Moments" }).click()
  const label = page.getByRole("textbox", {
    name: "What’s on screen at 0:00.0",
  })
  await label.fill("Opening screen")
  await label.press("Enter")
  await page.reload()
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Moments" })
    .click()
  await expect(
    page.getByRole("textbox", { name: "What’s on screen at 0:00.0" })
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
  // The Remotion Player owns time: read it from the transport bar.
  const position = page.getByLabel("Playback position")

  // A look saves every moment; wait out the saves while paused.
  await page.getByRole("button", { name: /^Product launch/ }).click()
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
  await expect(position).toHaveText(/^0:0(4\.9|5\.0) \/ 0:05\.0$/, {
    timeout: 10_000,
  })
  await expect(
    page.getByRole("button", { name: "Play", exact: true })
  ).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("key moments can be dragged, nudged and moved to the playhead", async ({
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
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()

  const timeline = page.getByRole("group", { name: "Timeline" })
  const cut = timeline.getByRole("button", {
    name: /^Select the moment at 0:02/,
  })
  await expect(cut).toBeVisible()
  // Wait until the editor is interactive: switching tools needs React.
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  await tools.getByRole("tab", { name: "Moments" }).click()
  await expect(page.getByRole("list", { name: "Key moments" })).toBeVisible()

  // Drag the cut at 2s to 80% of the 5s clip.
  const track = await timeline.boundingBox()
  const handle = await cut.boundingBox()
  if (!track || !handle) throw new Error("Timeline not visible")
  const y = handle.y + handle.height / 2
  await page.mouse.move(handle.x + handle.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width * 0.8, y, { steps: 8 })
  await page.mouse.up()
  const moved = timeline.getByRole("button", {
    name: /^Select the moment at 0:0(3\.9|4\.\d)/,
  })
  await expect(moved).toBeVisible()

  // It's saved: after a reload it's still there, and now counts as yours.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await page.reload()
  await expect(moved).toBeVisible()
  await tools.getByRole("tab", { name: "Moments" }).click()
  await expect(
    page.getByRole("list", { name: "Key moments" }).getByText("Added by you")
  ).toBeVisible()

  // Arrow keys nudge a focused moment by 0.1s.
  const before = (await moved.getAttribute("aria-label")) ?? ""
  await moved.focus()
  await page.keyboard.press("ArrowRight")
  await expect(moved).not.toHaveAttribute("aria-label", before)

  // "Move to playhead" puts it wherever the playhead is.
  await page.getByRole("slider", { name: "Playhead" }).press("Home")
  await page
    .getByRole("button", { name: /^Move the moment at .* to the playhead$/ })
    .click()
  await expect(
    timeline.getByRole("button", { name: /^Select the moment at 0:00\.0/ })
  ).toBeVisible()

  // 0:00 is the real start: the playhead and a moment at 0:00 sit exactly
  // on the strip's left edge (within a pixel), not nudged inward.
  const stripLeft = (await timeline.locator("img").boundingBox())?.x ?? NaN
  const centre = async (locator: Locator) => {
    const box = await locator.boundingBox()
    return box ? box.x + box.width / 2 : NaN
  }
  expect(
    Math.abs((await centre(page.getByTestId("playhead-line"))) - stripLeft)
  ).toBeLessThanOrEqual(1)
  expect(
    Math.abs(
      (await centre(
        timeline.getByRole("button", { name: /^Select the moment at 0:00\.0/ })
      )) - stripLeft
    )
  ).toBeLessThanOrEqual(1)
  await expectNoViolations(page)
  expect(consoleProblems).toEqual([])
})

test("cut, speed up and add transitions between parts", async ({
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
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const position = page.getByLabel("Playback position")
  const saved = page.getByText("Saved", { exact: true })
  await expect(position).toHaveText("0:00.0 / 0:05.0")

  // S splits at the playhead (here 1s) and opens the new part.
  const playhead = page.getByRole("slider", { name: "Playhead" })
  await playhead.focus()
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("s")
  await expect(tools.getByRole("tab", { name: "Cuts" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  const parts = page.getByRole("list", { name: "Parts" })
  await expect(parts.getByRole("listitem")).toHaveCount(2)

  // Part 2 comes in with a push; the ad overlaps the parts by 0.5s.
  await page.getByRole("button", { name: "Push", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Push", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(position).toHaveText(/\/ 0:04\.5$/)
  await expectNoViolations(page)

  // Cut part 1 and play part 2 at 2×: a 2 second ad.
  await parts.getByRole("button", { name: /^Part 1/ }).click()
  await page.getByRole("button", { name: "Cut out" }).click()
  await expect(position).toHaveText(/\/ 0:04\.0$/)
  await parts.getByRole("button", { name: /^Part 2/ }).click()
  await page.getByRole("button", { name: "2×", exact: true }).click()
  await expect(position).toHaveText(/\/ 0:02\.0$/)
  await expect(saved).toBeVisible()

  // Undo and redo step through the edits.
  await page.getByRole("button", { name: /^Undo/ }).click()
  await expect(position).toHaveText(/\/ 0:04\.0$/)
  await page.getByRole("button", { name: /^Redo/ }).click()
  await expect(position).toHaveText(/\/ 0:02\.0$/)
  await expect(saved).toBeVisible()

  // It plays through to the end of the (shorter) ad.
  await page.getByRole("button", { name: "Play", exact: true }).click()
  await expect(position).toHaveText(/^0:0(1\.9|2\.0) \/ 0:02\.0$/, {
    timeout: 10_000,
  })

  // Kept after a reload; the still colour bars can be sped up in one go.
  await page.reload()
  await expect(position).toHaveText("0:00.0 / 0:02.0")
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Cuts" })
    .click()
  await expect(page.getByTestId("cut-range")).toHaveCount(1)
  await parts.getByRole("button", { name: /^Part 2/ }).click()
  await page.getByRole("button", { name: "1×", exact: true }).click()
  await expect(position).toHaveText(/\/ 0:04\.0$/)
  await expect(page.getByText("Still stretches")).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "Speed them up" }).click()
  await expect(page.getByText("Still stretches play at 4×")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("add text in brand style, animated in, kept after a reload", async ({
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
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const stage = page.getByTestId("motion-stage")
  const saved = page.getByText("Saved", { exact: true })

  await tools.getByRole("tab", { name: "Text" }).click()
  await page.getByRole("button", { name: /^Title card/ }).click()
  const items = page.getByRole("list", { name: "Text items" })
  await expect(items.getByRole("listitem")).toHaveCount(2)
  // The headline is selected: write it and highlight the benefit.
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Chase invoices automatically")
  await page
    .getByRole("textbox", { name: "Highlight words" })
    .fill("automatically")
  await page.getByRole("button", { name: "Bottom", exact: true }).click()
  // One style for the whole video.
  await page.getByRole("button", { name: /^Blur resolve/ }).click()
  await expect(
    page.getByRole("button", { name: /^Blur resolve/ })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(saved).toBeVisible()
  // The stage shows it (paused just after it comes in).
  await expect(stage.getByText("Chase invoices automatically")).toBeVisible()
  await expectNoViolations(page)

  await page.reload()
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Text" })
    .click()
  await expect(items.getByText("Chase invoices automatically")).toBeVisible()
  await items.getByRole("button", { name: /Chase invoices/ }).click()
  await expect(
    page.getByRole("textbox", { name: "Highlight words" })
  ).toHaveValue("automatically")
  await expect(stage.getByText("Chase invoices automatically")).toBeVisible()
  // Removing it takes it off the stage.
  await page.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(items.getByRole("listitem")).toHaveCount(1)
  await expect(stage.getByText("Chase invoices automatically")).toBeHidden()
  expect(consoleProblems).toEqual([])
})

test("lens: depth of field on angled shots, progressive blur on the screen", async ({
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
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const stage = page.getByTestId("motion-stage")

  // Flat: nothing to blur, and the panel says why.
  await tools.getByRole("tab", { name: "Lens" }).click()
  await page.getByRole("button", { name: /^Shallow focus/ }).click()
  await expect(page.getByText(/The camera faces the screen here/)).toBeVisible()
  await expect(stage.getByTestId("depth-of-field")).toHaveCount(0)

  // An angled shot: the lens blurs what leans away.
  await page
    .getByRole("group", { name: "Timeline" })
    .getByRole("button", { name: /^Select the moment/ })
    .first()
    .click()
  await page.getByRole("button", { name: "Orbit left", exact: true }).click()
  await expect(
    stage.getByTestId("depth-of-field").locator("> div")
  ).toHaveCount(6)
  await tools.getByRole("tab", { name: "Lens" }).click()
  await page.getByRole("button", { name: "f/8" }).click()
  await expect(page.getByRole("button", { name: "f/8" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )

  // Progressive blur from all edges of the screen.
  await page.getByRole("switch", { name: "Progressive blur" }).click()
  await page.getByRole("button", { name: "All edges" }).click()
  await expect(
    stage.getByTestId("progressive-blur").locator("> div")
  ).toHaveCount(6)
  // Saves go out 500ms after the last change: let it start, then finish.
  await page.waitForTimeout(700)
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // Kept after a reload.
  await page.reload()
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Lens" })
    .click()
  await expect(page.getByRole("button", { name: "f/8" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(page.getByRole("button", { name: "All edges" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  expect(consoleProblems).toEqual([])
})

test("turn a moment into graphics, place them, and close on an end card", async ({
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
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const stage = page.getByTestId("motion-stage")
  const list = page.getByRole("list", { name: "Graphics on the ad" })

  // The moment at 2s becomes a spotlight with a label.
  await page
    .getByRole("group", { name: "Timeline" })
    .getByRole("button", { name: /^Select the moment/ })
    .first()
    .click()
  await tools.getByRole("tab", { name: "Graphics" }).click()
  await page.getByRole("button", { name: /^Spotlight \+ label/ }).click()
  await expect(list.getByRole("listitem")).toHaveCount(2)
  await page
    .getByRole("textbox", { name: "Label", exact: true })
    .fill("Colour bars")
  await expect(stage.getByText("Colour bars")).toBeVisible()

  // Place it: click the middle of the (flat) video.
  await page.getByRole("button", { name: "Place on video" }).click()
  await page.getByTestId("camera-frame").click()
  await expect(page.getByText(/^50% × 50%$/)).toBeVisible()

  // An end card closes the ad.
  await page.getByRole("button", { name: /^End card/ }).click()
  await page
    .getByRole("textbox", { name: "Headline", exact: true })
    .fill("Try Acme free")
  await expect(stage.getByText("Try Acme free")).toBeVisible()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await expectNoViolations(page)

  await page.reload()
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Graphics" })
    .click()
  await expect(list.getByRole("listitem")).toHaveCount(3)
  await expect(list.getByText("Callout · Colour bars")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("pro controls: shuttle keys, frame steps, and dragging on stage and timeline", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, info) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  // Keyboard and fine pointer work: desktop only.
  test.skip(info.project.name === "mobile", "Keyboard and pointer controls")
  test.setTimeout(150_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByTestId("footage-file").setInputFiles(video)
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const position = page.getByLabel("Playback position")
  const playhead = page.getByRole("slider", { name: "Playhead" })

  // L plays, L again doubles; K pauses.
  await playhead.focus()
  await page.keyboard.press("l")
  await page.keyboard.press("l")
  await expect(page.getByText("2× ▶")).toBeVisible()
  await page.keyboard.press("k")
  await expect(
    page.getByRole("button", { name: "Play", exact: true })
  ).toBeVisible()
  // Frame steps: three frames forward from the start is 0.1s.
  await page.keyboard.press("Home")
  for (let i = 0; i < 3; i++) await page.keyboard.press(".")
  await expect(position).toHaveText(/^0:00\.1 /)
  // ? shows the shortcuts.
  await page.keyboard.press("Shift+?")
  await expect(
    page.getByRole("dialog", { name: "Keyboard shortcuts" })
  ).toBeVisible()
  await page.keyboard.press("Escape")

  // Drag a headline on the stage: it snaps to the centre line.
  await tools.getByRole("tab", { name: "Text" }).click()
  await page.getByRole("button", { name: /^Headline/ }).click()
  // Its outline on the stage (the headline is the only item there).
  const handle = page.locator("[data-stage-item] polygon").last()
  const box = await handle.boundingBox()
  const stage = await page.getByTestId("motion-stage").boundingBox()
  if (!box || !stage) throw new Error("No handle")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // From the top (y 0.14) to just off the middle: snaps to 0.5.
  await page.mouse.move(box.x + box.width / 2, stage.y + stage.height * 0.51, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(
    page.getByRole("button", { name: "Centre", exact: true })
  ).toHaveAttribute("aria-pressed", "true")

  // Drag its block on the timeline to 2s (it snaps to the moment there).
  const items = page.getByRole("list", { name: "Text items" })
  await expect(items.getByText("0:00.1")).toBeVisible()
  const track = await page
    .getByRole("group", { name: "Timeline" })
    .boundingBox()
  const block = page.getByText("Your headline here", { exact: true }).last()
  const blockBox = await block.boundingBox()
  if (!track || !blockBox) throw new Error("No block")
  const inset = 12
  const xAt = (ms: number) =>
    track.x + inset + ((track.width - 2 * inset) * ms) / 5000
  await page.mouse.move(blockBox.x + 6, blockBox.y + blockBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    xAt(2030) + (blockBox.x + 6 - xAt(100)),
    blockBox.y + blockBox.height / 2,
    {
      steps: 10,
    }
  )
  await page.mouse.up()
  await expect(items.getByText(/^0:02\.0$/)).toBeVisible()

  // Delete removes the selected text.
  await playhead.focus()
  await page.keyboard.press("Delete")
  await expect(items).toBeHidden()
  expect(consoleProblems).toEqual([])
})

test("layers: drop items on the timeline, stack them, and move them on the video", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, info) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.skip(info.project.name === "mobile", "Drag and drop with a mouse")
  test.setTimeout(150_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByTestId("footage-file").setInputFiles(video)
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  // Beginner order, opening on one-click looks.
  await expect(tools.getByRole("tab")).toHaveText([
    "AI",
    "Looks",
    "Moments",
    "Camera",
    "Cuts",
    "Text",
    "Graphics",
    "Lens",
    "Style",
  ])
  await expect(tools.getByRole("tab", { name: "Looks" })).toHaveAttribute(
    "aria-selected",
    "true"
  )

  // Drag a focus area from the Graphics panel onto layer 1 at about 1s.
  await tools.getByRole("tab", { name: "Graphics" }).click()
  const layer1 = page.locator('[data-track="0"]')
  const box = await layer1.boundingBox()
  if (!box) throw new Error("No layer")
  await page.getByRole("button", { name: /^Focus area/ }).dragTo(layer1, {
    targetPosition: { x: 12 + (box.width - 24) * 0.2, y: box.height / 2 },
  })
  const graphics = page.getByRole("list", { name: "Graphics on the ad" })
  await expect(graphics.getByRole("listitem")).toHaveCount(1)
  await expect(graphics.getByText(/^0:01\.0$/)).toBeVisible()
  // Circle, blurring inside instead.
  await page.getByRole("button", { name: "Circle", exact: true }).click()
  await page.getByRole("button", { name: "Inside the shape" }).click()
  await expect(
    page.getByText(/The shape is blurred and the rest stays sharp/)
  ).toBeVisible()

  // Drop a headline on the new layer above it: it lands on layer 2.
  await tools.getByRole("tab", { name: "Text" }).click()
  const newLayer = page.locator('[data-track="1"]')
  const top = await newLayer.boundingBox()
  if (!top) throw new Error("No new layer row")
  await page.getByRole("button", { name: /^Headline/ }).dragTo(newLayer, {
    targetPosition: { x: 12 + (top.width - 24) * 0.2, y: top.height / 2 },
  })
  await expect(page.getByText("Layer 2", { exact: true }).last()).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Send backward" })
  ).toBeEnabled()
  // Send it back under the focus area's layer, then forward again.
  await page.getByRole("button", { name: "Send backward" }).click()
  await expect(
    page.getByRole("button", { name: "Send backward" })
  ).toBeDisabled()
  await page.getByRole("button", { name: "Bring forward" }).click()

  // On the video: pick the headline up and drop it on the centre line.
  const position = page.getByLabel("Playback position")
  await expect(position).toHaveText(/^0:01\./)
  const headline = page.locator("[data-stage-item] polygon").last()
  const at = await headline.boundingBox()
  const stage = await page.getByTestId("motion-stage").boundingBox()
  if (!at || !stage) throw new Error("No stage item")
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
  await page.mouse.down()
  await page.mouse.move(at.x + at.width / 2, stage.y + stage.height * 0.505, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(
    page.getByRole("button", { name: "Centre", exact: true })
  ).toHaveAttribute("aria-pressed", "true")

  // The focus area moves across the (flat) screen when dragged.
  await tools.getByRole("tab", { name: "Graphics" }).click()
  await graphics.getByRole("button").first().click()
  const where = page.getByText(/^\d+% × \d+%$/)
  const before = await where.textContent()
  const area = page.locator("[data-stage-item] polygon").first()
  const areaBox = await area.boundingBox()
  if (!areaBox) throw new Error("No focus area on stage")
  await page.mouse.move(areaBox.x + areaBox.width / 2, areaBox.y + 6)
  await page.mouse.down()
  await page.mouse.move(areaBox.x + areaBox.width / 2 - 120, areaBox.y + 6, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(where).not.toHaveText(before ?? "")
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("playback never freezes at a cut, even on a slow connection", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, info) => {
  // Regression (2026-09-27): each part's new video element had to load at
  // the cut and the Player waited for it, so playback stalled at part
  // boundaries over the internet.
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.skip(info.project.name === "mobile", "One run is enough")
  test.setTimeout(150_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByTestId("footage-file").setInputFiles(video)
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const position = page.getByLabel("Playback position")

  // Three parts: 0–1s, then 1–3s and 3–5s at 2× (a split keeps the speed).
  const playhead = page.getByRole("slider", { name: "Playhead" })
  await playhead.focus()
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("s")
  await page.getByRole("button", { name: "2×", exact: true }).click()
  await playhead.focus()
  await page.keyboard.press("Home")
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("s")
  await expect(position).toHaveText(/\/ 0:03\.0$/)
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()

  // A slow, far-away bucket: every request 800ms slower (a new video
  // element needs several, so the old per-part elements missed the cut).
  await page.context().route("**/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  await playhead.focus()
  await page.keyboard.press("Home")
  await page.getByRole("button", { name: "Play", exact: true }).click()
  let last = ""
  let stuckSince = Date.now()
  let longestStuckMs = 0
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    const text = (await position.textContent()) ?? ""
    const playing = await page
      .getByRole("button", { name: "Pause", exact: true })
      .isVisible()
    if (text !== last) {
      last = text
      stuckSince = Date.now()
    } else if (playing) {
      longestStuckMs = Math.max(longestStuckMs, Date.now() - stuckSince)
    }
    if (!playing && text.startsWith("0:0")) break
    await page.waitForTimeout(100)
  }
  expect(last).toMatch(/^0:0(2\.9|3\.0) \/ 0:03\.0$/)
  expect(longestStuckMs).toBeLessThan(1000)
  expect(consoleProblems).toEqual([])
})

test("text slides and split screens, and Space plays from anywhere", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, info) => {
  test.skip(!hasStorage, "Needs a bucket (NEON_BRANCH or STORAGE_TESTS)")
  test.setTimeout(150_000)
  const video = await makeTestVideo()
  await createKitByHand(page)
  await page.getByRole("tab", { name: "Footage" }).click()
  await page.getByTestId("footage-file").setInputFiles(video)
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const stage = page.getByTestId("motion-stage")
  const frame = page.getByTestId("camera-frame")
  const list = page.getByRole("list", { name: "Graphics on the ad" })

  // A text slide: words on their own, over the whole stage.
  await tools.getByRole("tab", { name: "Text" }).click()
  await page.getByRole("button", { name: /^Text slide Words on/ }).click()
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Meet Acme")
  await expect(stage.getByText("Meet Acme")).toBeVisible()
  // Its title and line each have their own size.
  const titleHeight = async () =>
    (await stage.getByText("Meet Acme").boundingBox())!.height
  const before = await titleHeight()
  await page.getByRole("slider", { name: "Title size" }).focus()
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight")
  await expect(page.getByText("150%", { exact: true })).toBeVisible()
  await expect.poll(titleHeight).toBeGreaterThan(before * 1.3)
  await expect(page.getByRole("slider", { name: "Line size" })).toBeVisible()
  const slide = stage.locator('[data-layout="slide"]')
  expect((await slide.boundingBox())!.width).toBeCloseTo(
    (await stage.boundingBox())!.width,
    0
  )
  await stage.screenshot({ path: info.outputPath("slide.png") })

  // A split screen 4s later: the video glides into the left half…
  await page.getByRole("slider", { name: "Playhead" }).focus()
  await page.keyboard.press("Home")
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowRight")
  await tools.getByRole("tab", { name: "Text" }).click()
  await page.getByRole("button", { name: /^Split screen Video on one/ }).click()
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Ship in minutes")
  await expect(stage.getByText("Ship in minutes")).toBeVisible()
  const centreX = async (locator: Locator) => {
    const box = (await locator.boundingBox())!
    return box.x + box.width / 2
  }
  const stageBox = (await stage.boundingBox())!
  const middle = stageBox.x + stageBox.width / 2
  const portrait = stageBox.height > stageBox.width
  if (!portrait) {
    await expect
      .poll(async () => (await frame.boundingBox())!.width)
      .toBeLessThan(stageBox.width * 0.5)
    await expect.poll(() => centreX(frame)).toBeLessThan(middle)
  }
  await stage.screenshot({ path: info.outputPath("split-left.png") })
  // …or the right one.
  await page.getByRole("button", { name: "Right", exact: true }).click()
  if (!portrait) {
    await expect.poll(() => centreX(frame)).toBeGreaterThan(middle)
  }
  await stage.screenshot({ path: info.outputPath("split-right.png") })

  // Space plays and pauses even with a button focused.
  await page.getByRole("button", { name: "Right", exact: true }).focus()
  await page.keyboard.press("Space")
  await expect(
    page.getByRole("button", { name: "Pause", exact: true })
  ).toBeVisible()
  await page.keyboard.press("Space")
  await expect(
    page.getByRole("button", { name: "Play", exact: true })
  ).toBeVisible()
  // The button itself wasn't pressed by Space.
  await expect(
    page.getByRole("button", { name: "Right", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  // The playhead runs over every row of the timeline.
  await expect(page.getByTestId("playhead-line")).toBeVisible()

  await page.waitForTimeout(700)
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await expectNoViolations(page)
  await page.reload()
  await page
    .getByRole("tablist", { name: "Editor tools" })
    .getByRole("tab", { name: "Graphics" })
    .click()
  await expect(list.getByText("Text slide · Meet Acme")).toBeVisible()
  await list.getByText("Text slide · Meet Acme").click()
  await expect(page.getByText("150%", { exact: true })).toBeVisible()
  await expect(list.getByText("Split screen · Ship in minutes")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("colour any text, give it a background, and watch full screen", async ({
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
  const card = page.getByRole("listitem").filter({ hasText: "Product demo" })
  await expect(card.getByText("Ready")).toBeVisible({ timeout: 60_000 })
  await card.getByRole("link", { name: "Product demo" }).click()
  const tools = page.getByRole("tablist", { name: "Editor tools" })
  const stage = page.getByTestId("motion-stage")

  await tools.getByRole("tab", { name: "Text" }).click()
  await page.getByRole("button", { name: /^Title card/ }).click()
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Ship it today")
  const onStage = stage.locator("[data-item-id]", { hasText: "Ship it today" })
  const style = (property: "color" | "backgroundColor") =>
    onStage.evaluate((el, p) => getComputedStyle(el)[p], property)

  // A swatch colours the text; any colour can be a box behind it, and
  // Auto keeps the text readable on it.
  await page
    .getByRole("group", { name: "Text colour" })
    .getByRole("button", { name: "Use #15171c" })
    .click()
  await expect.poll(() => style("color")).toBe("rgb(21, 23, 28)")
  await page
    .getByRole("group", { name: "Text colour" })
    .getByRole("button", { name: "Auto" })
    .click()
  await page.getByLabel("Pick any background").fill("#fde047")
  await expect.poll(() => style("backgroundColor")).toBe("rgb(253, 224, 71)")
  await expect.poll(() => style("color")).toBe("rgb(21, 23, 28)")

  // Graphics too: a text slide's title in any colour, on its own colour.
  await page.getByRole("button", { name: /^Text slide Words on/ }).click()
  await page.getByLabel("Pick any title colour").fill("#22c55e")
  await page.getByLabel("Pick any background").fill("#111827")
  const slide = stage.locator('[data-layout="slide"]')
  await expect
    .poll(() => slide.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(17, 24, 39)")
  await expect(slide.getByText("Your big idea")).toBeVisible()
  await expect
    .poll(() =>
      slide
        .getByText("Your big idea")
        .evaluate((el) => getComputedStyle(el.closest("div")!).color)
    )
    .toBe("rgb(34, 197, 94)")
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()
  await expectNoViolations(page)

  // Full screen: the stage alone, with its own controls; Space still plays.
  await page.getByRole("button", { name: "Full screen" }).click()
  const box = page.getByTestId("stage-box")
  await expect(box).toHaveAttribute("data-fullscreen", "true")
  const controls = page.getByTestId("fullscreen-controls")
  await expect(controls.getByRole("button", { name: "Play" })).toBeVisible()
  const viewport = page.viewportSize()!
  const stageBox = (await stage.boundingBox())!
  expect(
    Math.max(stageBox.width / viewport.width, stageBox.height / viewport.height)
  ).toBeGreaterThan(0.98)
  await page.keyboard.press("Space")
  await expect(controls.getByRole("button", { name: "Pause" })).toBeAttached()
  // While playing, the controls fade once the pointer rests.
  await expect(controls).not.toHaveAttribute("data-shown", "true", {
    timeout: 6000,
  })
  await page.keyboard.press("Space")
  await expect(controls).toHaveAttribute("data-shown", "true")
  await page.keyboard.press("Escape")
  await expect(box).not.toHaveAttribute("data-fullscreen", "true")
  // F goes back in.
  await page.keyboard.press("f")
  await expect(box).toHaveAttribute("data-fullscreen", "true")
  await controls.getByRole("button", { name: "Exit full screen" }).click()
  await expect(box).not.toHaveAttribute("data-fullscreen", "true")
  expect(consoleProblems).toEqual([])
})
