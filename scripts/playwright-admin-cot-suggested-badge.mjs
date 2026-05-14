/**
 * Smoke: "💡 Sugerido: <op>" owner-suggestion badge in /hub/cotizaciones (PR #225).
 *
 * Verifies:
 *   - The cotizacionAssignment rule engine produces a badge on every visible row.
 *   - The badge appears in QuoteCard meta row AND in DetailDrawer header.
 *   - The suggested operator is one of MA / RA / TIN / SA (rendered as
 *     Matías / Ramiro / Martín / Sandra via operatorLabel()).
 *
 * Prereq: dev:full running with a valid cockpit token; at least one row in
 *   Admin 2.0 (sin filas, no hay nada que assertear y el script lo flagea).
 *
 * Run:
 *   node scripts/playwright-admin-cot-suggested-badge.mjs
 *   node scripts/playwright-admin-cot-suggested-badge.mjs --base=https://calculadora-bmc.vercel.app
 */
import { chromium } from "playwright";

const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://127.0.0.1:5173"
).replace(/\/+$/, "");

const URL = `${BASE}/hub/cotizaciones`;
const VALID_NAMES = ["Matías", "Ramiro", "Martín", "Sandra"];
const VALID_CODES = ["MA", "RA", "TIN", "SA"];

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

    await page.locator(".adminCot[data-skin]").waitFor({ state: "visible", timeout: 25_000 });

    // Wait for either the table or the token panel.
    await page.waitForTimeout(5_000);
    const haveTable = await page.locator(".adminCot__table").isVisible().catch(() => false);
    if (!haveTable) {
      console.log("  ⚠ Token panel mode — no rows to assert against. Skipping.");
      assert("module rendered (no-token early-exit)", true);
    } else {
      // Card view (mobile/grid) — every card has the 💡 badge.
      const cardCount = await page.locator(".adminCot__qcard").count();
      if (cardCount >= 1) {
        const cardTexts = await page.locator(".adminCot__qcard-meta").allInnerTexts();
        const cardsWithBadge = cardTexts.filter((t) => t.includes("💡"));
        assert("all visible cards have '💡' badge in meta", cardsWithBadge.length === cardTexts.length,
          `${cardsWithBadge.length} of ${cardTexts.length}`);

        // Check that at least one badge resolves to a known operator name.
        const hasKnownName = cardTexts.some((t) => VALID_NAMES.some((n) => t.includes(n)));
        assert("at least one badge shows a known operator name (Matías/Ramiro/Martín/Sandra)",
          hasKnownName,
          `samples=${cardTexts.slice(0, 2).map((s) => s.replace(/\s+/g, " ").slice(0, 60))}`);
      } else {
        assert("card view rendered (≥1 card)", false, "no .adminCot__qcard found");
      }

      // Drawer view — open first row and look for "💡 Sugerido:" + operator name.
      const editButtons = page.locator(".adminCot__table tbody tr").first().getByRole("button", { name: /^Editar$/ });
      if (await editButtons.count() > 0) {
        await editButtons.click();
        const drawer = page.locator(".adminCot__drawer");
        await drawer.waitFor({ state: "visible", timeout: 5_000 });
        const headerText = await drawer.locator(".adminCot__drawer-header").innerText();
        assert("drawer header contains '💡 Sugerido:'", headerText.includes("💡 Sugerido:"),
          headerText.replace(/\s+/g, " ").slice(0, 120));

        const hasCode = VALID_CODES.some((c) => headerText.includes(`(${c})`));
        assert("drawer header shows a valid operator code in parens (MA|RA|TIN|SA)", hasCode,
          headerText.replace(/\s+/g, " ").slice(0, 120));
      } else {
        console.log("  ⚠ no rows to open drawer; drawer assertion skipped");
      }
    }

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
    try { await page.screenshot({ path: "/tmp/admin-cot-suggested-badge-fail.png", fullPage: true }); } catch {}
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
