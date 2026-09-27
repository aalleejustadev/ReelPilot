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
  await expect(tools.getByRole("tab", { name: "Shot" })).toHaveAttribute(
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
  await tools.getByRole("tab", { name: "Effects" }).click()
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
    page.getByRole("textbox", { name: "Describe the motion" })
  ).toHaveValue(/^Zoom into each key moment/)

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
  await page.getByRole("textbox", { name: "Label" }).fill("Colour bars")
  await expect(stage.getByText("Colour bars")).toBeVisible()

  // Place it: click the middle of the (flat) video.
  await page.getByRole("button", { name: "Place on video" }).click()
  await page.getByTestId("camera-frame").click()
  await expect(page.getByText(/^50% × 50%$/)).toBeVisible()

  // An end card closes the ad.
  await page.getByRole("button", { name: /^End card/ }).click()
  await page.getByRole("textbox", { name: "Headline" }).fill("Try Acme free")
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
