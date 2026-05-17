#!/usr/bin/env node
/**
 * NotebookLM video assets — DEEP wizard capture.
 *
 * Drives the Solo Techo wizard happy path and snapshots the key
 * intermediate states that the surface capture script can't reach:
 *   - Panel family selector
 *   - Espesor (thickness) selector
 *   - Color selector
 *   - Dimensiones with area calculated
 *   - Plano 2D with cota chain rendered
 *   - BOM by groups + total USD
 *   - Print preview (PDF view)
 *
 * Output goes to docs/notebooklm-assets/ alongside the surface deck.
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app/";
const OUT = resolve(process.cwd(), "docs/notebooklm-assets");
const VIEWPORT = { width: 1440, height: 900 };

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[deep] ${m}`);
const results = [];

function leftPanel(page) {
  return page.locator("#root .bmc-left-panel");
}

function nextBtn(page) {
  return leftPanel(page).getByRole("button", { name: "Siguiente" }).last();
}

async function next(page) {
  const btn = nextBtn(page);
  await btn.waitFor({ state: "attached", timeout: 10000 });
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 5000, force: true }).catch(() => {});
  await page.waitForTimeout(350);
}

async function shot(page, name, opts = {}) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: opts.fullPage || false });
  log(`  saved ${name}.png`);
  results.push({ name, ok: true });
}

async function fail(name, err) {
  log(`✗ ${name} — ${err.message}`);
  results.push({ name, ok: false, err: err.message });
}

async function main() {
  log(`Base: ${BASE}`);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--ignore-certificate-errors", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "es-UY", ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log(`[err] ${e.message}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('button:has-text("Siguiente")', { timeout: 30000 });
  await page.waitForTimeout(1200);

  // ── Step 1: Solo Techo ─────────────────────────────────────────
  try {
    const soloTecho = page.getByText(/Solo Techo/i).first();
    await soloTecho.click({ force: true });
    await page.waitForTimeout(300);
    await next(page);
  } catch (e) { await fail("step1-escenario", e); }

  // ── Step 2: Familia panel + screenshot ─────────────────────────
  try {
    await page.waitForTimeout(500);
    await shot(page, "deep-02-familia-panel");
    const isodecEps = page.getByRole("button", { name: /ISODEC EPS/i }).first();
    if (await isodecEps.isVisible().catch(() => false)) {
      await isodecEps.click({ force: true });
      await page.waitForTimeout(300);
    }
    // Some scenarios show a 1 agua / 2 aguas toggle here
    const unaAgua = page.getByRole("button", { name: /1 agua|una agua/i }).first();
    if (await unaAgua.isVisible().catch(() => false)) await unaAgua.click().catch(() => {});
    await next(page);
  } catch (e) { await fail("step2-familia", e); }

  // ── Step 3: Espesor + screenshot ───────────────────────────────
  try {
    await page.waitForTimeout(400);
    await shot(page, "deep-03-espesor");
    const esp = leftPanel(page).getByRole("button", { name: /^\d+\s*mm$/ }).first();
    if (await esp.isVisible().catch(() => false)) {
      await esp.click({ force: true });
      await page.waitForTimeout(200);
    }
    await next(page);
  } catch (e) { await fail("step3-espesor", e); }

  // ── Step 4: Color ──────────────────────────────────────────────
  try {
    await page.waitForTimeout(400);
    await shot(page, "deep-04-color");
    const blanco = page.getByRole("button", { name: /^Blanco$/ }).first();
    if (await blanco.isVisible().catch(() => false)) await blanco.click({ force: true });
    await next(page);
  } catch (e) { await fail("step4-color", e); }

  // ── Step 5: Dimensiones (largo + ancho) ────────────────────────
  try {
    await page.waitForTimeout(500);
    const inputs = leftPanel(page).locator("input[data-stepper-chain='1']");
    const n = await inputs.count();
    if (n >= 2) {
      await inputs.nth(0).click(); await inputs.nth(0).fill("6.5"); await inputs.nth(0).press("Tab");
      await inputs.nth(1).click(); await inputs.nth(1).fill("5.6"); await inputs.nth(1).press("Tab");
      await page.waitForTimeout(400);
    }
    await shot(page, "deep-05-dimensiones");
    await next(page);
  } catch (e) { await fail("step5-dimensiones", e); }

  // ── Step 6 (Pendiente — passthrough) ──────────────────────────
  try { await next(page); } catch {}

  // ── Step 7: Estructura ─────────────────────────────────────────
  try {
    await page.waitForTimeout(400);
    const metal = page.getByRole("button", { name: "Metal", exact: true }).first();
    if (await metal.isVisible().catch(() => false)) await metal.click({ force: true });
    await next(page);
  } catch (e) { await fail("step7-estructura", e); }

  // ── Step 8: Plano 2D + asignación de bordes ────────────────────
  try {
    await page.waitForTimeout(800);
    const plan = page.locator('[data-bmc-capture="roof-plan-2d"]').first();
    await plan.waitFor({ state: "visible", timeout: 15000 });
    await plan.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, "deep-06-plano-2d-cotas");
    // tight crop of just the SVG
    try {
      const path2 = `${OUT}/deep-06b-plano-2d-zoom.png`;
      await plan.screenshot({ path: path2 });
      log(`  saved deep-06b-plano-2d-zoom.png`);
    } catch {}

    // Try assigning all 4 borders
    const rects = plan.locator('[data-bmc-layer="planta-bordes-assign"] rect');
    const rcount = await rects.count();
    for (let i = 0; i < rcount; i++) {
      const box = await rects.nth(i).boundingBox();
      if (!box || box.width < 3 || box.height < 3) continue;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(150);
      // pick first available perfil
      for (const name of [/Gotero simple/i, /Gotero/i, /Cumbrera/i, /Pretil/i, /Babeta/i]) {
        const opt = page.getByRole("button", { name }).first();
        if (await opt.isVisible().catch(() => false)) {
          await opt.click().catch(() => {});
          await page.waitForTimeout(120);
          break;
        }
      }
    }
    await page.waitForTimeout(400);
    await shot(page, "deep-07-bordes-asignados");
    await next(page);
  } catch (e) { await fail("step8-plano-2d", e); }

  // ── Steps 9–11: avanzar hasta BOM ──────────────────────────────
  for (let s = 0; s < 5; s++) {
    try {
      await page.waitForTimeout(350);
      const stepLabel = await page.locator("text=/PASO \\d+ DE \\d+/").first().textContent().catch(() => "");
      if (!stepLabel) break;
      const visible = await nextBtn(page).isVisible().catch(() => false);
      if (!visible) break;
      // proyecto step
      const nombre = page.locator('input[placeholder*="nombre"], input[placeholder*="cliente"]').first();
      if (await nombre.isVisible().catch(() => false)) {
        await nombre.fill("Demo NotebookLM").catch(() => {});
      }
      await next(page);
    } catch { break; }
  }

  // ── BOM final + totales ────────────────────────────────────────
  try {
    await page.waitForTimeout(800);
    await shot(page, "deep-08-bom-completo", { fullPage: true });
    // Scroll to totals at bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await shot(page, "deep-09-totales-usd");
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch (e) { await fail("bom-totales", e); }

  // ── Imprimir → preview PDF ─────────────────────────────────────
  try {
    const imprimir = page.getByRole("button", { name: /Imprimir/i }).first();
    if (await imprimir.isVisible().catch(() => false)) {
      await imprimir.click({ force: true });
      await page.waitForTimeout(1500);
      await shot(page, "deep-10-preview-pdf", { fullPage: true });
    }
  } catch (e) { await fail("preview-pdf", e); }

  // ── Cerrar preview, abrir Panelín chat ────────────────────────
  try {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    const panelinBtn = page.getByRole("button", { name: /Panel(in|ín)/i }).first();
    if (await panelinBtn.isVisible().catch(() => false)) {
      await panelinBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await shot(page, "deep-11-panelin-chat-abierto");
    }
  } catch (e) { await fail("panelin-chat", e); }

  await browser.close();

  console.log("\n═══ Resumen DEEP ═══");
  for (const r of results) {
    const flag = r.ok ? "✓" : "✗";
    console.log(`  ${flag} ${r.name}${r.err ? " — " + r.err : ""}`);
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nTotal OK: ${okCount}/${results.length}\n`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
