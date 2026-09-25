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
  await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute(
    "aria-selected",
    "true"
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

test("collapsed sidebar centres its icons", async ({
  page,
  context,
  baseURL,
  signedInUser: _user,
}, testInfo) => {
  test.skip(isMobile(testInfo.project.name), "Desktop sidebar only")
  await context.addCookies([
    { name: "sidebar_state", value: "false", url: baseURL! },
  ])
  await page.goto("/dashboard")

  const offsets = await page.evaluate(() => {
    const rail = document
      .querySelector('[data-slot="sidebar-container"]')!
      .getBoundingClientRect()
    const centre = rail.left + rail.width / 2
    return [
      ...document.querySelectorAll(
        '[data-slot="sidebar-container"] [data-sidebar="menu-button"]'
      ),
    ].map((button) => {
      const box = button.getBoundingClientRect()
      return Math.abs(box.left + box.width / 2 - centre)
    })
  })

  expect(offsets.length).toBeGreaterThan(0)
  for (const offset of offsets) expect(offset).toBeLessThanOrEqual(0.5)
})

test("page content is a centred column", async ({
  page,
  signedInUser: _user,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto("/settings/profile")

  const heading = page.getByRole("heading", { level: 1, name: "Settings" })
  const gaps = await heading.evaluate((element) => {
    const column = element.closest(".mx-auto")!.getBoundingClientRect()
    const inset = document
      .querySelector('[data-slot="sidebar-inset"]')!
      .getBoundingClientRect()
    return { left: column.left - inset.left, right: inset.right - column.right }
  })

  expect(Math.abs(gaps.left - gaps.right)).toBeLessThanOrEqual(1)
  await expect(heading).toHaveCSS("text-align", "start")
})

test("settings tabs switch pages and show the active tab", async ({
  page,
  signedInUser: _user,
  consoleProblems,
}) => {
  await page.goto("/settings/profile")
  const workspaceTab = page.getByRole("tab", { name: "Workspace" })
  await expect(workspaceTab).toHaveAttribute("aria-selected", "false")

  await workspaceTab.click()

  await expect(page).toHaveURL(/\/settings\/workspace$/)
  await expect(workspaceTab).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute(
    "aria-selected",
    "false"
  )
  await expect(page.getByLabel("Workspace name")).toBeVisible()
  expect(consoleProblems).toEqual([])
})

test("the header user menu matches the sidebar menu", async ({
  page,
  signedInUser,
  consoleProblems,
}) => {
  await page.goto("/dashboard")

  await page.getByRole("button", { name: "Open user menu" }).click()
  const menu = page.getByRole("menu")

  await expect(menu.getByText("Ada Lovelace")).toBeVisible()
  await expect(menu.getByText(signedInUser.email)).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible()
  await menu.getByRole("menuitem", { name: "Workspace settings" }).click()

  await expect(page).toHaveURL(/\/settings\/workspace$/)
  expect(consoleProblems).toEqual([])
})
