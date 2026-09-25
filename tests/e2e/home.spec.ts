import { expect, test } from "@playwright/test"

test("home page shows the hero and auth buttons", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("ReelPilot")
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your app, in ads that sell it.",
    })
  ).toBeVisible()
  const header = page.getByRole("banner")
  await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible()
  await expect(header.getByRole("link", { name: "Sign up" })).toBeVisible()
})

test("no horizontal scroll at the current viewport", async ({ page }) => {
  await page.goto("/")

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
