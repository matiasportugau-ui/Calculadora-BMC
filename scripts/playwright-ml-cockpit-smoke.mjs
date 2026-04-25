/**
 * Smoke: ML cockpit AUTOMATISMOS panel loads and renders switches.
 *
 * Uso:
 *   node scripts/playwright-ml-cockpit-smoke.mjs
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 node scripts/playwright-ml-cockpit-smoke.mjs
 *
 * No requiere token — el panel AUTOMATISMOS se renderiza siempre
 * (los switches quedan disabled={!token} pero el DOM existe).
 */
import { chromium } from "playwright";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app").replace(/\/+$/, "");
const URL_ML = `${BASE}/hub/ml`;
const SCREENSHOT = process.env.PLAYWRIGHT_SCREENSHOT || "";

let passed = 0;
let failed = 0;
const errors = [];

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m  ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m  ${name}${detail ? "  →  " + detail : ""}`);
    failed++;
    errors.push(name);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on("console", msg => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", err => consoleErrors.push(err.message));

console.log("\nML cockpit AUTOMATISMOS smoke");
console.log(`  URL: ${URL_ML}\n`);

// ── 1. Page load ──────────────────────────────────────────────────────────────
try {
  const res = await page.goto(URL_ML, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const ok = res && (res.status() === 200 || res.status() === 304);
  assert("Page load", ok, `HTTP ${res?.status()}`);
} catch (e) {
  assert("Page load", false, e.message);
  await browser.close();
  process.exit(1);
}

// ── 2. AUTOMATISMOS heading visible ──────────────────────────────────────────
try {
  await page.getByText(/AUTOMATISMOS/i).first().waitFor({ timeout: 15_000 });
  assert("AUTOMATISMOS heading visible");
} catch {
  assert("AUTOMATISMOS heading visible", false, "not found within 15s");
}

// ── 3. Aircraft switch ML-AUTO-PULL rendered ──────────────────────────────────
try {
  await page.locator('[aria-label="ML-AUTO-PULL"]').first().waitFor({ state: "attached", timeout: 8_000 });
  assert('AircraftSwitch [aria-label="ML-AUTO-PULL"] in DOM');
} catch {
  assert('AircraftSwitch [aria-label="ML-AUTO-PULL"] in DOM', false, "not found");
}

// ── 4. Aircraft switch CRM-AUTO-PULL rendered ────────────────────────────────
try {
  const el = await page.locator('[aria-label="CRM-AUTO-PULL"]').first();
  const attached = await el.evaluate(n => !!n).catch(() => false);
  assert('AircraftSwitch [aria-label="CRM-AUTO-PULL"] in DOM', attached);
} catch {
  assert('AircraftSwitch [aria-label="CRM-AUTO-PULL"] in DOM', false, "not found");
}

// ── 5. No TDZ / ReferenceError crash ─────────────────────────────────────────
const tdz = consoleErrors.filter(e =>
  e.includes("ReferenceError") || e.includes("Cannot access") || e.includes("is not defined")
);
assert("No TDZ / ReferenceError crash", tdz.length === 0, tdz[0]?.slice(0, 80) || "clean");

// ── Screenshot on failure ─────────────────────────────────────────────────────
if (failed > 0 && SCREENSHOT) {
  await page.screenshot({ path: SCREENSHOT, fullPage: true });
  console.log(`  screenshot: ${SCREENSHOT}`);
} else if (failed > 0) {
  const auto = `reports/ml-cockpit-fail-${Date.now()}.png`;
  await page.screenshot({ path: auto, fullPage: true }).catch(() => {});
  console.log(`  screenshot: ${auto}`);
}

await browser.close();

console.log(`\nRESULTADO: ${passed}/${passed + failed} checks passed${failed ? ` — ${failed} failed (${errors.join(", ")})` : ""}\n`);
process.exit(failed > 0 ? 1 : 0);
