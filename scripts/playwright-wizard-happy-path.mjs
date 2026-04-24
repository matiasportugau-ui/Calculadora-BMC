/**
 * Smoke E2E: wizard Solo Techo happy path (11 pasos) → BOM completo con precios.
 *
 * Verifica:
 *   - Todos los pasos del wizard se completan sin error
 *   - BOM incluye grupos PANELES, FIJACIONES, SELLADORES
 *   - Total USD > 0
 *   - Planta 2D ([data-bmc-capture="roof-plan-2d"]) visible antes de bordes
 *   - Imprimir genera previewHTML (sin navegar fuera del wizard)
 *
 * Uso:
 *   npm run dev:full  (en otra terminal)
 *   node scripts/playwright-wizard-happy-path.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173/";
const VIEWPORT = { width: 1400, height: 900 };

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function wizardSiguienteBtn(page) {
  return page.locator("#root .bmc-left-panel").getByRole("button", { name: "Siguiente" }).last();
}

async function wizardSiguiente(page, timeout = 20000) {
  await page.evaluate(() => {
    const p = document.querySelector("#root .bmc-left-panel");
    if (p) p.scrollTop = p.scrollHeight;
  }).catch(() => {});
  // Try left panel first, then fall back to any Siguiente on page
  let btn = wizardSiguienteBtn(page);
  const inPanel = await btn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!inPanel) {
    btn = page.getByRole("button", { name: "Siguiente" }).last();
  }
  await btn.waitFor({ state: "attached", timeout });
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 15000, force: true });
  await page.waitForTimeout(200);
}

async function pickFirstGoteroLike(page) {
  const candidates = [
    page.getByRole("button", { name: "Gotero simple", exact: true }),
    page.getByRole("button", { name: /Gotero frontal/i }).first(),
    page.getByRole("button", { name: /Gotero Lateral/i }).first(),
    page.getByRole("button", { name: /Cumbrera/i }).first(),
    page.getByRole("button", { name: /Pretil/i }).first(),
  ];
  for (const loc of candidates) {
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
      await page.waitForTimeout(100);
      return true;
    }
  }
  return false;
}

async function assignBordersViaPlanta2D(page, maxRounds = 6) {
  const svg = page.locator('[data-bmc-capture="roof-plan-2d"]').first();
  await svg.waitFor({ state: "visible", timeout: 25000 });
  await svg.scrollIntoViewIfNeeded();
  const siguiente = wizardSiguienteBtn(page);
  for (let round = 0; round < maxRounds; round++) {
    if (!(await siguiente.isDisabled().catch(() => true))) return;
    const rects = svg.locator('[data-bmc-layer="planta-bordes-assign"] rect');
    const n = await rects.count();
    for (let i = 0; i < n; i++) {
      if (!(await siguiente.isDisabled().catch(() => true))) return;
      const strip = rects.nth(i);
      const box = await strip.boundingBox();
      if (!box || box.width < 2 || box.height < 2) continue;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);
      await pickFirstGoteroLike(page);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() =>
    chromium.launch({ headless: true })
  );
  const page = await browser.newPage({ viewport: VIEWPORT });

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") jsErrors.push(msg.text());
  });

  console.log("\n═══ Wizard Solo Techo — Happy Path E2E ═══\n");

  // ── Cargar app ────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('button:has-text("Siguiente")', { timeout: 45000 });
  const appLoaded = await page.locator('text=PASO 1 DE').isVisible().catch(() => false);
  assert("App cargó en :5173", appLoaded);

  // ── Paso 1: Escenario ─────────────────────────────────────────
  const soloTechoCard = page.locator("#root").getByText("Solo Techo").first();
  assert("Solo Techo visible en paso 1", await soloTechoCard.isVisible().catch(() => false));
  await wizardSiguiente(page);

  // ── Paso 2: Familia panel ─────────────────────────────────────
  // tipoAguas toggle puede aparecer aquí
  const unaAguaBtn = page.getByRole("button", { name: /1 agua|una agua/i }).first();
  if (await unaAguaBtn.isVisible().catch(() => false)) {
    await unaAguaBtn.click();
    await page.waitForTimeout(150);
  }
  await wizardSiguiente(page);

  // ── Paso 3: Espesor ───────────────────────────────────────────
  // Seleccionar primer espesor disponible si hay botones
  const espButtons = page.locator("#root .bmc-left-panel").getByRole("button", { name: /^\d+ mm$/ });
  const espCount = await espButtons.count();
  if (espCount > 0) await espButtons.first().click().catch(() => {});
  await wizardSiguiente(page);

  // ── Paso 4: Color ─────────────────────────────────────────────
  const blancoBtn = page.getByRole("button", { name: /^Blanco$/ }).first();
  if (await blancoBtn.isVisible().catch(() => false)) await blancoBtn.click();
  await wizardSiguiente(page);

  // ── Paso 5: Dimensiones ──────────────────────────────────────
  const panel = page.locator("#root .bmc-left-panel");
  const chainInputs = panel.locator("input[data-stepper-chain='1']");
  const inputCount = await chainInputs.count();
  if (inputCount >= 2) {
    await chainInputs.nth(0).click();
    await chainInputs.nth(0).fill("6");
    await chainInputs.nth(0).press("Tab");
    await chainInputs.nth(1).click();
    await chainInputs.nth(1).fill("5");
    await chainInputs.nth(1).press("Tab");
    await page.waitForTimeout(300);
  }
  const areaText = await page.locator("text=/\\d+\\.\\d+m²/").first().textContent().catch(() => "—");
  assert("Dimensiones calculan área > 0", areaText !== "0.0m²" && areaText !== "—", "área: " + areaText);
  await wizardSiguiente(page);

  // ── Paso 6: Pendiente ─────────────────────────────────────────
  await wizardSiguiente(page);

  // ── Paso 7: Estructura ───────────────────────────────────────
  const metalBtn = page.getByRole("button", { name: "Metal", exact: true }).first();
  if (await metalBtn.isVisible().catch(() => false)) await metalBtn.click();
  await wizardSiguiente(page);

  // ── Paso 8: Bordes (planta 2D) ───────────────────────────────
  const roofPlan = page.locator('[data-bmc-capture="roof-plan-2d"]').first();
  const roofPlanVisible = await roofPlan.isVisible().catch(() => false);
  assert("Planta 2D visible en paso Bordes", roofPlanVisible);

  await assignBordersViaPlanta2D(page);
  const siguienteEnabled = !(await wizardSiguienteBtn(page).isDisabled().catch(() => true));
  assert("Siguiente habilitado tras asignar bordes", siguienteEnabled);
  await wizardSiguiente(page);

  // ── Paso 9: Selladores ───────────────────────────────────────
  await wizardSiguiente(page);

  // ── Paso 10: Flete ───────────────────────────────────────────
  await wizardSiguiente(page);

  // ── Paso 11: Datos del proyecto ──────────────────────────────
  const nombreInput = panel.locator('input[placeholder*="nombre"], input[placeholder*="cliente"], input[placeholder*="Cliente"]').first();
  if (await nombreInput.isVisible().catch(() => false)) {
    await nombreInput.fill("QA Happy Path");
  }
  await wizardSiguiente(page);

  // ── Verificar BOM en panel derecho ───────────────────────────
  await page.waitForTimeout(500);
  const bodyText = await page.evaluate(() => document.body.innerText);

  assert("BOM grupo PANELES presente", bodyText.includes("PANELES"), "");
  assert("BOM grupo FIJACIONES presente", bodyText.includes("FIJACIONES") || bodyText.includes("fijacion"), "");
  assert("BOM grupo SELLADORES presente", bodyText.includes("SELLADORES") || bodyText.includes("sellador") || bodyText.includes("Silicona"), "");
  assert("Total USD visible", /USD\s*[\d,.]+|[\d,.]+\s*USD|\$[\d,.]+/.test(bodyText), "");

  const totalMatch = bodyText.match(/TOTAL\s+USD[^\d]*([\d,.]+)/i);
  const totalVal = totalMatch ? parseFloat(totalMatch[1].replace(/[,.]/g, (m) => (m === "." ? "." : ""))) : 0;
  assert("Total USD > 0", totalVal > 0, "total: " + (totalMatch?.[1] || "not found"));

  // ── Verificar Imprimir genera preview ────────────────────────
  const imprimirBtn = page.getByRole("button", { name: /Imprimir/i }).first();
  if (await imprimirBtn.isVisible().catch(() => false)) {
    await imprimirBtn.click();
    await page.waitForTimeout(600);
    const previewVisible = await page.locator('text=/Cotizaci[oó]n|cotizaci[oó]n/i').first().isVisible().catch(() => false);
    assert("Preview PDF abre al hacer Imprimir", previewVisible);
  } else {
    assert("Botón Imprimir visible", false, "no encontrado en BOM step");
  }

  // ── Sin errores JS críticos ───────────────────────────────────
  const criticalErrors = jsErrors.filter((e) => !e.includes("ResizeObserver") && !e.includes("favicon"));
  assert("Sin errores JS críticos", criticalErrors.length === 0, criticalErrors.slice(0, 3).join(" | "));

  await browser.close();

  console.log(`\n════════════════════════════════════════`);
  console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
