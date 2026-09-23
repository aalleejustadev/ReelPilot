import { expect, test } from "@playwright/test"

test("home page renders", async ({ page }) => {
  await page.goto("/")

  await expect(page).toHaveTitle("ReelPilot")
  await expect(page.getByRole("heading", { name: "ReelPilot" })).toBeVisible()
})
