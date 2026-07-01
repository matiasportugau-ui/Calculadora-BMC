import { defineConfig } from "@playwright/test";

/**
 * E2E for /panelin/live — character UI + voice session mint (no WebRTC in CI).
 *
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 \
 *   TOUR_SESSION_COOKIE="$(BMC_API_BASE=http://127.0.0.1:5173 node scripts/mint-tour-session.mjs)" \
 *   npx playwright test -c playwright.panelin-live.config.ts
 */
export default defineConfig({
  testDir: "scripts",
  testMatch: /panelin-live-e2e\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, ""),
    headless: true,
    channel: "chrome",
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
});