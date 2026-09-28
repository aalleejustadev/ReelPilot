import { expect, hasDatabase, test } from "./fixtures"
import { expectNoViolations } from "./helpers/axe"
import { createKitByHand } from "./helpers/brand-kits"

const publicPages = [
  "/",
  "/sign-in",
  "/sign-up",
  "/sign-in?error=INVALID_TOKEN",
  "/this-page-does-not-exist",
]

for (const path of publicPages) {
  test(`no accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path)
    await expectNoViolations(page)
  })
}

test.describe("signed in", () => {
  test.skip(!hasDatabase, "Signed-in tests need a database")

  for (const path of [
    "/dashboard",
    "/videos",
    "/brand-kits",
    "/settings/profile",
    "/settings/workspace",
  ]) {
    test(`no accessibility violations on ${path}`, async ({
      page,
      signedInUser: _user,
    }) => {
      await page.goto(path)
      await expectNoViolations(page)
    })
  }

  test("no accessibility violations with the user menu open", async ({
    page,
    signedInUser: _user,
  }) => {
    await page.goto("/dashboard")
    await page.getByRole("button", { name: "Open user menu" }).click()
    await expect(page.getByRole("menu")).toBeVisible()
    await expectNoViolations(page)
  })

  test("no accessibility violations on a validation error", async ({
    page,
    signedInUser: _user,
  }) => {
    await page.goto("/settings/profile")
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("   ")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Enter your name.")).toBeVisible()
    await expectNoViolations(page)
  })

  test("no accessibility violations in the brand kit editor, with errors and the delete dialog", async ({
    page,
    signedInUser: _user,
  }) => {
    await createKitByHand(page)
    await expectNoViolations(page)

    await page.getByRole("button", { name: "Add claim" }).click()
    await page.getByRole("textbox", { name: "Source link" }).fill("nope")
    await page.getByRole("button", { name: "Save changes" }).first().click()
    await expect(
      page.getByText("Use a full link starting with https://.")
    ).toBeVisible()
    await expectNoViolations(page)

    await page.getByRole("button", { name: "Delete", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await expectNoViolations(page)
  })

  test("no accessibility violations with the font menu open", async ({
    page,
    signedInUser: _user,
  }) => {
    await createKitByHand(page)
    await page.getByRole("combobox", { name: "Heading font" }).click()
    await expect(page.getByRole("option", { name: "Inter" })).toBeVisible()
    await expectNoViolations(page)
  })

  test("no accessibility violations on the brand kit list and create error", async ({
    page,
    signedInUser: _user,
  }) => {
    await createKitByHand(page)
    await page.goto("/brand-kits")
    await expectNoViolations(page)
  })

  test("no accessibility violations on the footage tab and recorder dialog", async ({
    page,
    signedInUser: _user,
  }) => {
    await createKitByHand(page)
    await page.getByRole("tab", { name: "Footage" }).click()
    await expect(page.getByText("No footage yet")).toBeVisible()
    await expectNoViolations(page)

    await page.getByRole("button", { name: "Record your screen" }).click()
    // Named: toasts are dialogs too.
    await expect(
      page.getByRole("dialog", { name: "Record your screen" })
    ).toBeVisible()
    await expectNoViolations(page)
  })
})
