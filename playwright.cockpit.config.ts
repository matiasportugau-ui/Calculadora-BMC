import { defineConfig } from "@playwright/test";

/**
 * Config dedicada al E2E interactivo del Cockpit (/hub/wa). Aislada de
 * playwright.config.ts (product tour) para mantener cada spec single-purpose.
 *
 * El harness corre contra PROD por diseño ("Prod E2E") — el stack local NO está
 * aislado (misma DB Supabase + misma planilla CRM compartida), así que la red de
 * seguridad es el nivel de agresividad (COCKPIT_E2E_LEVEL), no el entorno.
 *
 * Uso:
 *   PLAYWRIGHT_BASE_URL=https://calculadora-bmc.vercel.app \
 *   TOUR_SESSION_COOKIE=<valor bmc_sess> \
 *   COCKPIT_E2E_LEVEL=0 \
 *   npx playwright test -c playwright.cockpit.config.ts scripts/cockpit-e2e.spec.ts
 */
export default defineConfig({
  testDir: "scripts",
  testMatch: /cockpit-e2e\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // Una sola página/sesión: el refresh-token rota en cada /auth/refresh y reusarlo
  // dispara reuse-detection (mata la sesión). retries=0 → nunca re-disparar un send.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: (process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app").replace(/\/+$/, ""),
    headless: true,
    // Pin al host de Vercel: el cookie bmc_sess se adjunta por dominio y la API se
    // alcanza vía el proxy del SPA. NUNCA apuntar a la URL cruda de Cloud Run (el
    // cookie no viajaría). El proxy del sandbox usa CA propia → opt-in explícito.
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
});
