#!/usr/bin/env node
/**
 * NotebookLM video assets — automated screenshot capture.
 *
 * Captures the 14 frames described in docs/NOTEBOOKLM-VIDEO-ONESHOT
 * (or the inline NotebookLM input) by driving the live calculator with
 * Playwright. Saves PNGs to docs/notebooklm-assets/.
 *
 * Usage:
 *   node scripts/notebooklm-capture.mjs
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173/ node scripts/notebooklm-capture.mjs
 *
 * Each capture is wrapped in try/catch so partial failure still produces
 * the rest of the deck. A summary table is printed at the end.
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app/";
const OUT = resolve(process.cwd(), "docs/notebooklm-assets");
const VIEWPORT = { width: 1440, height: 900 };

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const log = (m) => console.log(`[capture] ${m}`);
const results = [];

async function shot(page, name, { fullPage = false } = {}) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage });
  log(`  saved ${name}.png`);
  return path;
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: e.message });
    log(`✗ ${name} — ${e.message}`);
  }
}

async function clickIfVisible(page, locator, ms = 1500) {
  try {
    await locator.waitFor({ state: "visible", timeout: ms });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ timeout: ms, force: true });
    return true;
  } catch {
    return false;
  }
}

async function wizardNext(page) {
  const btn = page.getByRole("button", { name: /siguiente/i }).last();
  await btn.waitFor({ state: "visible", timeout: 8000 });
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 5000, force: true }).catch(() => {});
  await page.waitForTimeout(400);
}

async function fillByLabel(page, label, value) {
  const inputs = [
    page.getByLabel(label, { exact: false }),
    page.locator(`label:has-text("${label}") input`).first(),
    page.locator(`input[name*="${label.toLowerCase()}"]`).first(),
  ];
  for (const loc of inputs) {
    if (await loc.isVisible().catch(() => false)) {
      await loc.fill(String(value));
      return true;
    }
  }
  return false;
}

async function main() {
  log(`Base URL: ${BASE}`);
  log(`Output dir: ${OUT}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
      "--disable-dev-shm-usage",
    ],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: "es-UY",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log(`  [page-error] ${e.message}`));

  // ── 01 — Home / Wizard Paso 1 ─────────────────────────────────
  await step("01-home-wizard-paso1", async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "01-home-wizard-paso1");
  });

  // ── 02 — Selector escenario / panel ───────────────────────────
  await step("02-selector-escenario", async () => {
    const soloTecho = page.getByText(/Solo Techo/i).first();
    if (await soloTecho.isVisible().catch(() => false)) {
      await shot(page, "02-selector-escenario");
      await soloTecho.click({ force: true });
      await page.waitForTimeout(400);
      await wizardNext(page);
    } else {
      await shot(page, "02-selector-escenario");
    }
  });

  // ── 03 — Familia y espesor de panel (paso 2) ──────────────────
  await step("03-familia-espesor-panel", async () => {
    await page.waitForTimeout(800);
    await shot(page, "03-familia-espesor-panel");
    // Try advancing to dimensiones
    for (let i = 0; i < 2; i++) {
      await wizardNext(page).catch(() => {});
      await page.waitForTimeout(400);
    }
  });

  // ── 04 — Dimensiones de techo ─────────────────────────────────
  await step("04-dimensiones-techo", async () => {
    await page.waitForTimeout(600);
    // Try filling largo/ancho
    await fillByLabel(page, "Largo", 6.5).catch(() => {});
    await fillByLabel(page, "Ancho", 5.6).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, "04-dimensiones-techo");
    await wizardNext(page).catch(() => {});
    await page.waitForTimeout(500);
  });

  // ── 05 — Plano 2D de cotas (data-bmc-capture="roof-plan-2d") ──
  await step("05-plano-2d-cotas", async () => {
    const plano = page.locator('[data-bmc-capture="roof-plan-2d"]').first();
    const visible = await plano.isVisible({ timeout: 8000 }).catch(() => false);
    if (visible) {
      await plano.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      await shot(page, "05-plano-2d-cotas");
      // Also save a focused crop using the SVG element
      try {
        const path = `${OUT}/05b-plano-2d-cotas-zoom.png`;
        await plano.screenshot({ path });
        log(`  saved 05b-plano-2d-cotas-zoom.png`);
      } catch {}
    } else {
      // fallback: take whatever is visible right now
      await shot(page, "05-plano-2d-cotas");
    }
  });

  // ── 06 — Avance hasta BOM ─────────────────────────────────────
  await step("06-bom-grupos", async () => {
    // Try several "Siguiente" until a BOM-like view appears
    for (let i = 0; i < 8; i++) {
      const bomVisible = await page.getByText(/BOM|Lista de materiales|Total/i).first().isVisible().catch(() => false);
      if (bomVisible) break;
      await wizardNext(page).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(800);
    await shot(page, "06-bom-grupos", { fullPage: true });
  });

  // ── 07 — Totales / pricing ────────────────────────────────────
  await step("07-pricing-totales", async () => {
    // Scroll to bottom for totals
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, "07-pricing-totales");
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  });

  // ── 08 — Acciones de export (PDF / WhatsApp / Drive) ──────────
  await step("08-acciones-export", async () => {
    const candidates = [
      page.getByRole("button", { name: /Imprimir|PDF/i }),
      page.getByRole("button", { name: /WhatsApp/i }),
      page.getByRole("button", { name: /Drive/i }),
    ];
    let found = false;
    for (const c of candidates) {
      if (await c.first().isVisible().catch(() => false)) {
        await c.first().scrollIntoViewIfNeeded().catch(() => {});
        found = true;
      }
    }
    await page.waitForTimeout(300);
    await shot(page, "08-acciones-export", { fullPage: !found });
  });

  // ── 09 — Hub / módulos operativos ────────────────────────────
  await step("09-hub-modulos", async () => {
    await page.goto(`${BASE.replace(/\/$/, "")}/hub`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "09-hub-modulos", { fullPage: true });
  });

  // ── 10 — Hub WA ───────────────────────────────────────────────
  await step("10-hub-wa", async () => {
    await page.goto(`${BASE.replace(/\/$/, "")}/hub/wa`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "10-hub-wa", { fullPage: true });
  });

  // ── 11 — Hub canales ──────────────────────────────────────────
  await step("11-hub-canales", async () => {
    await page.goto(`${BASE.replace(/\/$/, "")}/hub/canales`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "11-hub-canales", { fullPage: true });
  });

  // ── 12 — Hub admin ────────────────────────────────────────────
  await step("12-hub-admin", async () => {
    await page.goto(`${BASE.replace(/\/$/, "")}/hub/admin`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, "12-hub-admin", { fullPage: true });
  });

  // ── 13 — Panelín chat (intentar abrirlo desde la calculadora) ─
  await step("13-panelin-chat", async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const chatBtn = page.getByRole("button", { name: /Panel(in|ín)/i }).first();
    const opened = await clickIfVisible(page, chatBtn, 4000);
    if (!opened) {
      // try header avatar / badge
      await clickIfVisible(page, page.locator('[data-bmc-capture="panelin-chat-toggle"]'), 2000);
    }
    await page.waitForTimeout(1200);
    await shot(page, "13-panelin-chat");
  });

  // ── 14 — Presentación Matrix (diagrama vivo) ──────────────────
  await step("14-matrix-presentation", async () => {
    await page.goto(`${BASE.replace(/\/$/, "")}/matrix-presentation.html`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    await shot(page, "14-matrix-presentation", { fullPage: true });
  });

  await browser.close();

  // ── Resumen ───────────────────────────────────────────────────
  console.log("\n═══ Resumen de capturas ═══");
  for (const r of results) {
    const flag = r.ok ? "✓" : "✗";
    const detail = r.ok ? "" : ` — ${r.err}`;
    console.log(`  ${flag} ${r.name}  (${r.ms}ms)${detail}`);
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\nTotal OK: ${okCount}/${results.length}\nDir: ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
