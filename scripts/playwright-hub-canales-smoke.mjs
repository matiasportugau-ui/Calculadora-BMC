/**
 * Smoke: Wolfboard unified channels page loads (Playwright / headless Chromium).
 *
 * Uso: `npx vite` en :5173 (y API en :3001 si querés token auto), luego:
 *   node scripts/playwright-hub-canales-smoke.mjs
 *
 * Env: PLAYWRIGHT_BASE_URL (default http://127.0.0.1:5173)
 */
import { chromium } from "playwright";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const url = `${BASE}/hub/canales`;
const out = process.env.PLAYWRIGHT_SCREENSHOT || "";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.getByRole("heading", { name: /Canales · Inbox unificado/i }).waitFor({ timeout: 20_000 });
    const syncBtn = page.getByRole("button", { name: /Sincronizar todos/i });
    await syncBtn.waitFor({ state: "visible", timeout: 15_000 });
    if (out) {
      await page.screenshot({ path: out, fullPage: true });
      console.log("screenshot:", out);
    }
    console.log("OK", url);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL", e.message || e);
  process.exit(1);
});
