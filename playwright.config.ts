import { defineConfig, devices } from "@playwright/test"

const port = 3100
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Definition of Done: responsive down to 375px.
    {
      name: "mobile",
      use: { ...devices["iPhone 13 Mini"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Better Auth only accepts requests from BETTER_AUTH_URL's origin, so
    // the test server must use its own port, not .env's localhost:3000.
    env: { BETTER_AUTH_URL: baseURL, NEXT_PUBLIC_APP_URL: baseURL },
    timeout: 180_000,
  },
})
