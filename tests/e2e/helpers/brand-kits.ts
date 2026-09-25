import { expect, type Page } from "@playwright/test"

/**
 * Creates a kit through the real UI without AI or network: `.invalid` never
 * resolves, so reading the site fails and "Fill it in myself" appears.
 */
export async function createKitByHand(page: Page, host = "acme-e2e.invalid") {
  await page.goto("/brand-kits")
  await page.getByRole("textbox", { name: "Your app’s website" }).fill(host)
  await page.getByRole("button", { name: "Create from website" }).click()
  await expect(page.getByText(`We couldn’t reach ${host}.`)).toBeVisible({
    timeout: 20_000,
  })
  await page.getByRole("button", { name: "Fill it in myself" }).click()
  await expect(page).toHaveURL(/\/brand-kits\/[^/]+$/, { timeout: 20_000 })
  await expect(
    page.getByRole("heading", { level: 1, name: host })
  ).toBeVisible()
}
