import { expect, test } from "@playwright/test"

test("sign-up link in the header opens the sign-up page", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("banner").getByRole("link", { name: "Sign up" }).click()

  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(
    page.getByText("Create your account", { exact: true })
  ).toBeVisible()
})

test("sign-in page offers Google, GitHub and a magic link", async ({
  page,
}) => {
  await page.goto("/sign-in")

  await expect(page).toHaveTitle("Sign in · ReelPilot")
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" })
  ).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link" })
  ).toBeVisible()
})

test("an auth error in the URL is shown in plain language", async ({
  page,
}) => {
  await page.goto("/sign-in?error=INVALID_TOKEN")

  // Next.js adds its own empty role="alert" route announcer; match ours by text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "That sign-in link has expired or was already used." })
  ).toBeVisible()
})

test("signed-out visitors are sent from the dashboard to sign-in", async ({
  page,
}) => {
  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/sign-in$/)
})

for (const path of ["/sign-in", "/sign-up"]) {
  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(path)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("buttons show a pointer cursor", async ({ page }) => {
  await page.goto("/sign-in")

  const google = page.getByRole("button", { name: "Continue with Google" })
  await expect(google).toHaveCSS("cursor", "pointer")
})

test("navigation buttons show a spinner while the next page loads", async ({
  page,
}) => {
  await page.goto("/")
  // Hold the navigation request so the pending state is observable.
  await page.route("**/sign-up**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.continue()
  })
  const signUp = page.getByRole("banner").getByRole("link", { name: "Sign up" })

  await signUp.click()

  await expect(signUp.locator('[data-slot="spinner"]')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-up$/)
})

test("magic link button shows a spinner while the link is being sent", async ({
  page,
}) => {
  await page.goto("/sign-up")
  // Hold the request, then fake success, so no real email is sent.
  await page.route("**/api/auth/sign-in/magic-link", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.fulfill({ json: { status: true } })
  })
  await page.getByLabel("Email").fill("test@example.com")
  const submit = page.getByRole("button", { name: "Email me a sign-in link" })

  await submit.click()

  await expect(submit).toBeDisabled()
  await expect(submit.locator('[data-slot="spinner"]')).toBeVisible()
  await expect(page.getByText("Check your email")).toBeVisible()
  await expect(page.getByText("test@example.com")).toBeVisible()
})

test("signed-out visitors are sent from settings to sign-in", async ({
  page,
}) => {
  await page.goto("/settings/workspace")

  await expect(page).toHaveURL(/\/sign-in$/)
})
