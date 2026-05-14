/**
 * Smoke: per-row "✦ Sugerir IA" button in DetailDrawer of /hub/cotizaciones (PR #224).
 *
 * Verifies:
 *   - /hub/cotizaciones loads.
 *   - Cockpit token is acquired (browser-Origin path) OR the token panel is offered.
 *   - At least one row is in the table.
 *   - Clicking "Editar" opens the DetailDrawer.
 *   - The "✦ Sugerir IA" button is present in the Respuesta IA section header.
 *   - The button is NOT clicked — that would hit a real LLM. Presence is enough.
 *
 * Prereq: `npm run dev:full` (API :3001 + Vite :5173) running with valid
 *   `API_AUTH_TOKEN` / `EMAIL_INGEST_TOKEN` / Sheets creds so the cockpit
 *   token endpoint can respond.
 *
 * Run:
 *   node scripts/playwright-admin-cot-suggest-ia.mjs
 *   node scripts/playwright-admin-cot-suggest-ia.mjs --base=https://calculadora-bmc.vercel.app
 */
import { chromium } from "playwright";

const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://127.0.0.1:5173"
).replace(/\/+$/, "");

const URL = `${BASE}/hub/cotizaciones`;

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) { passed += 1; console.log(`  ✅ ${name}`); }
  else { failed += 1; console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const jsErrors = [];
  page.on("pageerror", (err) => jsErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") jsErrors.push(`console.error: ${msg.text()}`);
  });

  try {
    console.log(`\n→ Goto ${URL}`);
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Module mounted (data-skin attribute proves we're inside the v2 module).
    const moduleEl = page.locator(".adminCot[data-skin]");
    await moduleEl.waitFor({ state: "visible", timeout: 25_000 });
    assert("admin v2 module rendered (.adminCot[data-skin])", true);

    // Token: either auto-loaded → table appears, or panel offered.
    // We give the cockpit-token endpoint ~5s and then check what's on screen.
    await page.waitForTimeout(5_000);
    const haveTable = await page.locator(".adminCot__table").isVisible().catch(() => false);
    const haveTokenPanel = await page.getByText(/Token cockpit|Pegá el token|No se pudo cargar el token/i).first().isVisible().catch(() => false);
    assert("either the table loaded or the token panel was offered",
      haveTable || haveTokenPanel,
      `table=${haveTable} tokenPanel=${haveTokenPanel}`);

    if (!haveTable) {
      // Without a token we can't drive the drawer. Stop here gracefully — the
      // important assertion (module renders) already passed. CI sets the token
      // via env; local dev without API auth lands here.
      console.log("  ⚠ Token not auto-loaded. Skipping drawer assertions (set API_AUTH_TOKEN to enable).");
    } else {
      // Wait for at least one row.
      const rowSel = ".adminCot__table tbody tr";
      await page.waitForFunction(
        (sel) => document.querySelectorAll(sel).length >= 1,
        rowSel,
        { timeout: 15_000 }
      ).catch(() => {});
      const rowCount = await page.locator(rowSel).count();
      assert("at least one row in the admin table", rowCount >= 1, `rowCount=${rowCount}`);

      if (rowCount >= 1) {
        // Click the FIRST "Editar" button to open the DetailDrawer.
        await page.locator(".adminCot__table tbody tr").first().getByRole("button", { name: /^Editar$/ }).click();
        const drawer = page.locator(".adminCot__drawer");
        await drawer.waitFor({ state: "visible", timeout: 5_000 });
        assert("DetailDrawer opens on click Editar", true);

        // The Gap-2 button "✦ Sugerir IA" must be visible.
        const suggestBtn = drawer.getByRole("button", { name: /Sugerir IA/i });
        await suggestBtn.waitFor({ state: "visible", timeout: 5_000 });
        const enabled = await suggestBtn.isEnabled();
        const text = await suggestBtn.innerText();
        assert("'✦ Sugerir IA' button present in drawer", text.includes("Sugerir IA"));
        assert("'✦ Sugerir IA' button is enabled when consulta exists", enabled, `text="${text}"`);
      }
    }

    // No critical JS errors.
    const noisy = jsErrors.filter((e) =>
      !e.includes("ResizeObserver") &&
      !e.includes("favicon") &&
      !e.includes("500") &&
      !e.includes("net::ERR_ABORTED")
    );
    assert("no critical console errors", noisy.length === 0, noisy.slice(0, 3).join(" | "));
  } catch (e) {
    failed += 1;
    console.log(`  ❌ exception: ${e.message}`);
    try { await page.screenshot({ path: "/tmp/admin-cot-suggest-ia-fail.png", fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  RESULTADOS: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
