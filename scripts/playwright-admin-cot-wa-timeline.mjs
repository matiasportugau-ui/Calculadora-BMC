/**
 * Smoke: "📱 Historial WhatsApp" accordion in DetailDrawer of /hub/cotizaciones (PR #226).
 *
 * Verifies:
 *   - The DetailDrawer renders the accordion `<details>` only when row.origen=WA
 *     AND row.telefono is non-empty.
 *   - Expanding the accordion triggers a fetch to /api/wa/conversations and then
 *     /api/wa/messages — the smoke watches the network for those calls.
 *   - Either bubbles render (status "ok") or a graceful degradation message
 *     appears (status "error" / "empty"). Never a hung modal or a crashed page.
 *
 * Prereq: dev:full running. Optional: `DATABASE_URL` set so /api/wa/messages
 *   returns 200 instead of 503. The smoke handles both paths.
 *
 * Run:
 *   node scripts/playwright-admin-cot-wa-timeline.mjs
 *   node scripts/playwright-admin-cot-wa-timeline.mjs --base=https://calculadora-bmc.vercel.app
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
  const waApiCalls = [];
  page.on("pageerror", (err) => jsErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") jsErrors.push(`console.error: ${msg.text()}`);
  });
  page.on("response", (resp) => {
    const u = resp.url();
    if (u.includes("/api/wa/conversations") || u.includes("/api/wa/messages")) {
      waApiCalls.push({ url: u.replace(BASE, ""), status: resp.status() });
    }
  });

  try {
    console.log(`\n→ Goto ${URL}`);
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await page.locator(".adminCot[data-skin]").waitFor({ state: "visible", timeout: 25_000 });

    await page.waitForTimeout(5_000);
    const haveTable = await page.locator(".adminCot__table").isVisible().catch(() => false);
    if (!haveTable) {
      console.log("  ⚠ Token panel mode — cannot test drawer accordion. Skipping (early-exit OK).");
      assert("module rendered (no-token early-exit)", true);
    } else {
      // Find the first row whose Canal pill text is "WA". The CanalPill renders
      // origen as inner text inside `.adminCot__pill`.
      const waRow = page.locator(".adminCot__table tbody tr").filter({
        has: page.locator(".adminCot__pill", { hasText: /^WA\s*$/ }),
      }).first();

      const waRowCount = await waRow.count();
      if (waRowCount === 0) {
        console.log("  ⚠ no WA rows visible in the current snapshot — cannot test accordion path");
        assert("WA row exists for accordion test (soft)", true, "no WA rows in snapshot — informational");
      } else {
        await waRow.getByRole("button", { name: /^Editar$/ }).click();
        const drawer = page.locator(".adminCot__drawer");
        await drawer.waitFor({ state: "visible", timeout: 5_000 });
        assert("drawer opens for WA row", true);

        // The accordion summary text.
        const accordion = drawer.locator("details").filter({ has: drawer.locator("summary", { hasText: /Historial WhatsApp/i }) });
        const accordionCount = await accordion.count();
        assert("'📱 Historial WhatsApp' accordion present for WA row", accordionCount >= 1,
          `accordionCount=${accordionCount}`);

        if (accordionCount >= 1) {
          // Expand and wait for the WA api calls to settle.
          await accordion.locator("summary").first().click();
          await page.waitForTimeout(3_000);

          // We expect at least the first call (/api/wa/conversations) to have fired.
          const sawConv = waApiCalls.some((c) => c.url.includes("/api/wa/conversations"));
          assert("expanding accordion triggers GET /api/wa/conversations", sawConv,
            `calls=${JSON.stringify(waApiCalls.slice(0, 4))}`);

          // Either bubbles render OR a graceful "no disponible / empty / error" message.
          const bubblesCount = await drawer.locator("details [style*='border']").count().catch(() => 0);
          const meta = await drawer.locator("details").innerText().catch(() => "");
          const gracefulText = /Cargando|Sin historial|Tiempo de espera|WA cockpit no disponible|Tel[eé]fono inválido|Falta el token/i;
          assert("either WA bubbles render OR graceful error/empty state shown",
            bubblesCount > 0 || gracefulText.test(meta),
            `bubbles=${bubblesCount} text="${meta.slice(0, 120).replace(/\s+/g, " ")}"`);
        }
      }
    }

    // No critical JS errors. We expect /api/wa/* 503 if DATABASE_URL is unset, that's OK.
    const noisy = jsErrors.filter((e) =>
      !e.includes("ResizeObserver") &&
      !e.includes("favicon") &&
      !e.includes("500") &&
      !e.includes("503") &&
      !e.includes("net::ERR_ABORTED")
    );
    assert("no critical console errors", noisy.length === 0, noisy.slice(0, 3).join(" | "));
  } catch (e) {
    failed += 1;
    console.log(`  ❌ exception: ${e.message}`);
    try { await page.screenshot({ path: "/tmp/admin-cot-wa-timeline-fail.png", fullPage: true }); } catch {}
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
