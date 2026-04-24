/**
 * Smoke E2E: calculator wizard happy path → BOM (Playwright / headless Chromium).
 *
 * Escenario: Techo → dimensiones básicas → BOM con PANELES y total USD.
 * Apunta a producción por defecto; sobreescribir con PLAYWRIGHT_BASE_URL.
 *
 * Uso:
 *   npm run test:e2e:wizard
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e:wizard
 */
import { chromium } from "playwright";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app").replace(/\/+$/, "");
const out = process.env.PLAYWRIGHT_SCREENSHOT || "";

function siguiente(page) {
  return page.locator("#root .bmc-left-panel").getByRole("button", { name: "Siguiente" }).last();
}

async function clickSiguiente(page) {
  const btn = siguiente(page);
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  await page.waitForTimeout(250);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    // ── Cargar app ───────────────────────────────────────────────
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("#root .bmc-left-panel", { timeout: 30_000 });
    await page.getByText(/PASO 1 DE/i).waitFor({ timeout: 15_000 });
    console.log("OK  app cargó");

    // ── Paso 1: Escenario — Solo Techo ───────────────────────────
    await page.locator("#root").getByText("Solo Techo").first().waitFor({ timeout: 10_000 });
    console.log("OK  Solo Techo visible");
    await clickSiguiente(page);

    // ── Pasos 2-7: defaults (familia, espesor, color, dim, pend, estructura) ──
    for (let step = 2; step <= 5; step++) {
      // Paso 5: dimensiones — rellenar largo y ancho
      if (step === 5) {
        const inputs = page.locator("#root .bmc-left-panel").locator("input[data-stepper-chain='1']");
        if (await inputs.count() >= 2) {
          await inputs.nth(0).fill("10");
          await inputs.nth(0).press("Tab");
          await inputs.nth(1).fill("8");
          await inputs.nth(1).press("Tab");
          await page.waitForTimeout(300);
        }
      }
      await clickSiguiente(page);
    }
    // Pendiente y estructura: dos pasos más con defaults
    await clickSiguiente(page);
    await clickSiguiente(page);

    // ── Paso 8: Bordes — intentar asignar vía planta 2D ─────────
    const roofPlan = page.locator('[data-bmc-capture="roof-plan-2d"]').first();
    if (await roofPlan.isVisible().catch(() => false)) {
      const rects = roofPlan.locator('[data-bmc-layer="planta-bordes-assign"] rect');
      const n = await rects.count();
      for (let i = 0; i < n; i++) {
        const box = await rects.nth(i).boundingBox();
        if (box && box.width > 2) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(80);
        }
      }
    }
    await clickSiguiente(page);

    // ── Pasos 9-11: selladores, flete, datos proyecto ────────────
    await clickSiguiente(page);
    await clickSiguiente(page);
    await clickSiguiente(page);

    // ── Verificar BOM ────────────────────────────────────────────
    await page.waitForTimeout(500);
    if (out) { await page.screenshot({ path: out, fullPage: true }); console.log("screenshot:", out); }
    const body = await page.evaluate(() => document.body.innerText);
    if (!body.includes("PANELES")) throw new Error("BOM sin grupo PANELES");
    if (!/USD\s*[\d,.]+|[\d,.]+\s*USD|\$[\d,.]+/.test(body)) throw new Error("BOM sin total USD");
    console.log("OK  BOM con PANELES y total USD — wizard happy path completo");
    console.log("OK", BASE);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL", e.message || e);
  process.exit(1);
});
