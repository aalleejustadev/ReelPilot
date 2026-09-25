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
