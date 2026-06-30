import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Aufmaß-App.
 * Run with: bunx playwright test
 * Expects the Vite dev server on http://localhost:8080
 * (Lovable sandbox starts it automatically; locally use `bun run dev`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-iphone13",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
