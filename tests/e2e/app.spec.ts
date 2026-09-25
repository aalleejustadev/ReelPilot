import { expect, hasDatabase, test } from "./fixtures"

test.skip(!hasDatabase, "Signed-in tests need the real database in .env")

const isMobile = (projectName: string) => projectName === "mobile"

test("dashboard shows the welcome, workspace and empty state", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  await page.goto("/dashboard")

  await expect(page).toHaveTitle("Dashboard · ReelPilot")
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome, Ada" })
  ).toBeVisible()
  await expect(
    // Scoped to <main>: Next streaming keeps a hidden copy outside it.
    page.getByRole("main").getByText("Your workspace is ready")
  ).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
  expect(consoleProblems).toEqual([])
})

test("sidebar shows the workspace and navigates with real links", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, testInfo) => {
  await page.goto("/dashboard")
  if (isMobile(testInfo.project.name)) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  }
  const sidebar = page.locator('[data-slot="sidebar"]').last()

  await expect(sidebar.getByText("Ada’s workspace")).toBeVisible()
  // Nav items must be links, not buttons, for screen readers.
  await sidebar.getByRole("link", { name: "Settings" }).click()

  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Profile" })).toHaveAttribute(
    "aria-current",
    "page"
  )
  expect(consoleProblems).toEqual([])
})

test("editing your name updates it everywhere", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  await page.goto("/settings/profile")
  // Exact role query: the "Name saved" toast also matches getByLabel.
  const name = page.getByRole("textbox", { name: "Name", exact: true })

  await name.fill("Grace Hopper")
  const save = page.getByRole("button", { name: "Save" })
  await save.click()

  await expect(page.getByText("Name saved")).toBeVisible()
  await expect(name).toHaveValue("Grace Hopper")
  await page.goto("/dashboard")
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome, Grace" })
  ).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("an empty name shows an error and keeps what you typed", async ({
  page,
  signedInUser: _user,
}) => {
  await page.goto("/settings/profile")
  // Exact role query: the "Name saved" toast also matches getByLabel.
  const name = page.getByRole("textbox", { name: "Name", exact: true })

  await name.fill("   ")
  await page.getByRole("button", { name: "Save" }).click()

  await expect(page.getByText("Enter your name.")).toBeVisible()
  await expect(name).toHaveValue("   ")
})

test("renaming the workspace updates the sidebar", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}, testInfo) => {
  await page.goto("/settings/workspace")

  await page.getByLabel("Workspace name").fill("Launch team")
  await page.getByRole("button", { name: "Rename" }).click()

  await expect(page.getByText("Workspace renamed")).toBeVisible()
  if (isMobile(testInfo.project.name)) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  }
  await expect(
    page.locator('[data-slot="sidebar"]').last().getByText("Launch team")
  ).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("signing out from the user menu ends the session", async ({
  page,
  signedInUser,
}, testInfo) => {
  await page.goto("/dashboard")
  if (isMobile(testInfo.project.name)) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  }

  await page
    .locator('[data-slot="sidebar"]')
    .last()
    .getByRole("button", { name: new RegExp(signedInUser.email) })
    .click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()

  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/sign-in$/)
})

test("on mobile, the sidebar opens as a sheet and closes after navigating", async ({
  page,
  signedInUser: _user,
}, testInfo) => {
  test.skip(!isMobile(testInfo.project.name), "Mobile layout only")
  await page.goto("/dashboard")
  const sheet = page.getByRole("dialog")

  await page.getByRole("button", { name: "Toggle Sidebar" }).click()
  await expect(sheet).toBeVisible()
  await sheet.getByRole("link", { name: "Settings" }).click()

  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(sheet).toBeHidden()
})

test("unknown pages show a helpful not-found page", async ({ page }) => {
  await page.goto("/this-does-not-exist")

  await expect(page.getByText("Page not found")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Go to dashboard" })
  ).toBeVisible()
})
