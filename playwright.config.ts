import { defineConfig } from "@playwright/test";

/**
 * Config dedicada al product tour (docs/product). Aislada del resto de scripts
 * `.mjs` de scripts/ que se ejecutan con `node` directo, no con el test-runner.
 *
 * Uso:
 *   PLAYWRIGHT_BASE_URL=https://calculadora-bmc.vercel.app \
 *   TOUR_SESSION_COOKIE=<valor bmc_sess> \
 *   npx playwright test scripts/product-tour.spec.ts
 */
export default defineConfig({
  testDir: "scripts",
  testMatch: /product-tour\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: (process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app").replace(/\/+$/, ""),
    headless: true,
    // El proxy del sandbox usa una CA propia que Chromium no confía; los certs
    // de prod son válidos. Sin esto, page.goto falla con ERR_CERT_AUTHORITY_INVALID.
    ignoreHTTPSErrors: true,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    launchOptions: {
      // SwiftShader: WebGL por software para que los canvas 3D (LogistikBMC,
      // Panelín) pinten en chromium-headless-shell sin GPU.
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
});
