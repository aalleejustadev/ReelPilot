import { expect, hasDatabase, test } from "./fixtures"

test("sign in with the keyboard alone", async ({ page }) => {
  await page.route("**/api/auth/sign-in/magic-link", (route) =>
    route.fulfill({ json: { status: true } })
  )
  await page.goto("/sign-in")

  // Tab order: logo, Google, GitHub, email.
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "ReelPilot" })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(page.getByLabel("Email")).toBeFocused()
  await page.keyboard.type("keyboard@example.com")
  await page.keyboard.press("Enter")

  await expect(page.getByText("Check your email")).toBeVisible()
})

test("focused buttons show a visible focus ring", async ({ page }) => {
  await page.goto("/sign-in")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  const google = page.getByRole("button", { name: "Continue with Google" })

  await expect(google).toBeFocused()
  const ring = await google.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(ring).not.toBe("none")
})

test.describe("signed in", () => {
  test.skip(!hasDatabase, "Signed-in tests need a database")

  test("skip link jumps past the sidebar to the content", async ({
    page,
    signedInUser: _user,
  }) => {
    await page.goto("/dashboard")

    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Skip to content" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press("Enter")

    await expect(page.locator("#main-content")).toBeFocused()
  })

  test("user menu opens and works with the keyboard", async ({
    page,
    signedInUser: _user,
  }) => {
    await page.goto("/dashboard")
    const trigger = page.getByRole("button", { name: "Open user menu" })

    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menu")).toBeVisible()
    // WAI-ARIA menu pattern: opening with Enter focuses the first item.
    await expect(page.getByRole("menuitem", { name: "Profile" })).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(
      page.getByRole("menuitem", { name: "Workspace settings" })
    ).toBeFocused()
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(/\/settings\/workspace$/)
  })

  test("settings tabs move with the arrow keys", async ({
    page,
    signedInUser: _user,
  }) => {
    await page.goto("/settings/profile")
    const profile = page.getByRole("tab", { name: "Profile" })

    await profile.focus()
    await page.keyboard.press("ArrowRight")
    const workspace = page.getByRole("tab", { name: "Workspace" })
    await expect(workspace).toBeFocused()
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(/\/settings\/workspace$/)
  })

  test("sidebar navigation works with the keyboard", async ({
    page,
    signedInUser: _user,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop sidebar only")
    await page.goto("/dashboard")

    const settings = page
      .locator('[data-slot="sidebar-container"]')
      .getByRole("link", { name: "Settings" })
    await settings.focus()
    await page.keyboard.press("Enter")

    await expect(page).toHaveURL(/\/settings\/profile$/)
  })

  test("animations are off when reduced motion is requested", async ({
    page,
    signedInUser: _user,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop sidebar only")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/dashboard")

    const duration = await page
      .locator('[data-slot="sidebar-container"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.01)
  })
})
