import { expect, hasDatabase, test } from "./fixtures"
import { createKitByHand } from "./helpers/brand-kits"

test.skip(
  !hasDatabase,
  "Signed-in tests need a database (DATABASE_URL_UNPOOLED)"
)

// Logo upload writes to a real bucket: Neon locally, the S3 server in CI.
const hasStorage = Boolean(process.env.NEON_BRANCH || process.env.STORAGE_TESTS)

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
)

const noSidewaysScroll = async (page: import("@playwright/test").Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
  ).toBeLessThanOrEqual(0)

test("create, edit, save and delete a brand kit", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  // The longest flow here: many saves and page loads.
  test.setTimeout(60_000)
  // Dashboard points new users at brand kits.
  await page.goto("/dashboard")
  await page.getByRole("link", { name: "Create a brand kit" }).click()
  await expect(page).toHaveURL(/\/brand-kits$/)
  await expect(page.getByText("No brand kits yet")).toBeVisible()

  await createKitByHand(page)
  await expect(page).toHaveTitle("Brand kit · ReelPilot")

  // A mistake is marked on the exact field.
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Acme")
  await page.getByRole("button", { name: "Add claim" }).click()
  await page
    .getByRole("textbox", { name: "Claim 1", exact: true })
    .fill("Set up in 5 minutes")
  const source = page.getByRole("textbox", { name: "Source link" })
  await source.fill("not a link")
  await page.getByRole("button", { name: "Save changes" }).last().click()
  await expect(
    page.getByText("Use a full link starting with https://.")
  ).toBeVisible()
  await expect(source).toHaveAttribute("aria-invalid", "true")

  // Fixed, saved, and still there when reopened.
  await source.fill("https://acme.app/setup")
  await page
    .getByRole("textbox", { name: "Key features" })
    .fill("Reminders\nStripe payouts")
  // The swatch opens the system colour picker; the hex box follows it.
  await page.getByLabel("Pick primary colour").fill("#ff5a1f")
  await expect(
    page.getByRole("textbox", { name: "Primary colour", exact: true })
  ).toHaveValue("#ff5a1f")
  // Fonts come from the list, each shown in its own face, with a preview.
  await page.getByRole("combobox", { name: "Heading font" }).click()
  await page.getByRole("option", { name: "Bebas Neue" }).click()
  await expect(
    page.getByRole("combobox", { name: "Heading font" })
  ).toContainText("Bebas Neue")
  await expect(page.getByText("Acme", { exact: true }).last()).toHaveCSS(
    "font-family",
    /Bebas Neue/
  )
  await page.getByRole("button", { name: "Save changes" }).first().click()
  await expect(page.getByText("Brand kit saved")).toBeVisible()
  // Saving returns to the list; the changes are there when reopened.
  await expect(page).toHaveURL(/\/brand-kits$/)
  await page.getByRole("link", { name: "Acme details" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Acme" })
  ).toBeVisible()
  await expect(
    page.getByRole("textbox", { name: "Claim 1", exact: true })
  ).toHaveValue("Set up in 5 minutes")
  await expect(page.getByRole("textbox", { name: "Key features" })).toHaveValue(
    "Reminders\nStripe payouts"
  )
  await expect(
    page.getByRole("textbox", { name: "Primary colour", exact: true })
  ).toHaveValue("#ff5a1f")
  await expect(
    page.getByRole("combobox", { name: "Heading font" })
  ).toContainText("Bebas Neue")
  await noSidewaysScroll(page)

  // The list shows it, and the Free plan's one kit is used up. The card
  // opens the kit's footage; "Details" opens this form.
  await page.goto("/brand-kits")
  await expect(
    page.getByRole("link", { name: "Acme", exact: true })
  ).toHaveAttribute("href", /\/brand-kits\/[^/]+\/footage$/)
  await expect(page.getByText("0 clips")).toBeVisible()
  await expect(
    page.getByText("You’ve used every brand kit on your plan")
  ).toBeVisible()
  await noSidewaysScroll(page)

  // Delete asks first, then returns to the empty list.
  await page.getByRole("link", { name: "Acme details" }).click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(
    page.getByRole("alertdialog", { name: "Delete Acme?" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Delete brand kit" }).click()
  await expect(page).toHaveURL(/\/brand-kits$/)
  await expect(page.getByText("No brand kits yet")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("a private address is refused with a clear message", async ({
  page,
  signedInUser: _user,
}) => {
  await page.goto("/brand-kits")
  await page
    .getByRole("textbox", { name: "Your app’s website" })
    .fill("http://169.254.169.254/latest")
  await page.getByRole("button", { name: "Create from website" }).click()

  await expect(
    page.getByText(
      "That address isn’t a public website. Enter your app’s public URL."
    )
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByRole("textbox", { name: "Your app’s website" })
  ).toHaveAttribute("aria-invalid", "true")
})

test("an unknown kit shows the not-found page", async ({
  page,
  signedInUser: _user,
}) => {
  // Streamed pages can't change the status once sent; check the content.
  await page.goto("/brand-kits/not-a-real-kit")

  await expect(page.getByText("Page not found")).toBeVisible()
})

test("upload and remove a logo", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  test.skip(!hasStorage, "Needs the Neon bucket (NEON_BRANCH)")
  await createKitByHand(page)

  await page.locator("#brand-kit-logo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: png,
  })
  await expect(page.getByText("Logo uploaded")).toBeVisible({ timeout: 20_000 })
  const logo = page.getByRole("img", { name: "acme-e2e.invalid logo" })
  await expect(logo).toBeVisible()
  // Served from private storage through a signed link.
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(
    1
  )

  await page.getByRole("button", { name: "Remove", exact: true }).click()
  await expect(page.getByText("Logo removed")).toBeVisible()
  await expect(logo).toHaveCount(0)
  expect(consoleProblems).toEqual([])
})

test("a disguised file is refused as a logo", async ({
  page,
  signedInUser: _user,
}) => {
  await createKitByHand(page)

  await page.locator("#brand-kit-logo").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  })

  await expect(
    page.getByText("That file isn’t a PNG, JPEG or WebP image.", {
      exact: false,
    })
  ).toBeVisible()
})
