/**
 * Smoke local: wizard Solo techo → paso Bordes → asignación por planta 2D → RoofPreview:
 * escala gráfica (chrome exterior) y texto «Accesorios perimetrales (planta)».
 *
 * Uso: `npm run version:data && npx vite` en :5173, luego:
 *   node scripts/playwright-roof-bordes-local.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173/";
const VIEWPORT = { width: 1400, height: 900 };

/** Botón Siguiente del asistente (columna izquierda), sin confundir con otros botones homónimos fuera del grid principal. */
function wizardSiguienteBtn(page) {
  return page.locator("#root .bmc-left-panel").getByRole("button", { name: "Siguiente" }).last();
}

async function wizardSiguiente(page) {
  const panel = page.locator("#root .bmc-left-panel");
  await panel.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const btn = wizardSiguienteBtn(page);
  await btn.waitFor({ state: "attached", timeout: 35000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ timeout: 15000, force: true });
}

/** Elige un perfil del popover (planta 2D / lista). */
async function pickFirstGoteroLike(page) {
  const candidates = [
    page.getByRole("button", { name: "Gotero simple", exact: true }),
    page.getByRole("button", { name: /Gotero frontal/i }).first(),
    page.getByRole("button", { name: /Gotero Lateral/i }).first(),
  ];
  for (const loc of candidates) {
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
      await page.waitForTimeout(120);
      return true;
    }
  }
  return false;
}

/**
 * Paso Bordes: bandas clickeables en la planta 2D (`PlantaBordesEdgeStrips`).
 */
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
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: VIEWPORT });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('button:has-text("Siguiente")', { timeout: 30000 });

  await wizardSiguiente(page);

  await page.getByRole("button", { name: "1 Agua" }).click();
  await wizardSiguiente(page);

  await wizardSiguiente(page);

  const espBtn = page.locator('button[aria-label^="Seleccionar"]').first();
  await espBtn.click();
  await page.waitForTimeout(200);

  const sig0 = wizardSiguienteBtn(page);
  if (await sig0.isDisabled()) {
    await page.getByRole("button", { name: /^Blanco$/ }).first().click();
  }
  await wizardSiguiente(page);

  const group = page.locator(".bmc-left-panel [data-stepper-group]").first();
  const inputs = group.locator("input[data-stepper-chain='1']");
  await inputs.nth(0).click();
  await inputs.nth(0).fill("6");
  await inputs.nth(0).press("Enter");
  await inputs.nth(1).click();
  await inputs.nth(1).fill("5");
  await inputs.nth(1).press("Enter");
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) a.blur();
  });
  await page.waitForTimeout(150);
  await wizardSiguiente(page);
  await wizardSiguiente(page);

  await page.getByRole("button", { name: "Metal", exact: true }).click();
  await wizardSiguiente(page);

  await page.waitForTimeout(400);
  await assignBordersViaPlanta2D(page);

  const sig = wizardSiguienteBtn(page);
  if (await sig.isDisabled()) {
    await page.screenshot({ path: "/tmp/bmc-bordes-stuck.png", fullPage: true }).catch(() => {});
    throw new Error(
      "Siguiente sigue deshabilitado en Bordes: no se pudieron asignar todos los lados vía planta 2D. Captura: /tmp/bmc-bordes-stuck.png",
    );
  }

  await wizardSiguiente(page);
  await page.locator("#root .bmc-left-panel").getByRole("button", { name: "Anterior" }).last().click();

  await page.waitForSelector('[data-bmc-component="RoofPreview"]', { timeout: 25000 });
  const roof = page.locator('[data-bmc-view="roof-preview-2d"]').first();
  await roof.waitFor({ state: "visible", timeout: 20000 });

  const scaleBar = roof.locator('[data-bmc-layer="scale-bar"]');
  if ((await scaleBar.count()) < 1) {
    throw new Error("Objetivo no cumplido: falta [data-bmc-layer=scale-bar] en planta (paso Bordes, accesorios perimetrales).");
  }

  const hint = page.getByText(/Accesorios perimetrales \(planta\)/);
  if (!(await hint.isVisible())) {
    throw new Error('No visible el texto de ayuda "Accesorios perimetrales (planta)".');
  }

  await browser.close();
  if (errors.length) {
    console.warn("Advertencias (primeras 6):\n", errors.slice(0, 6).join("\n"));
  }
  console.log("OK — Smoke local: Bordes + planta 2D con escala + copy perimetral.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
