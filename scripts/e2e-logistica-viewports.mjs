/**
 * Slice A — /logistica Mesa de ruta at 390 / 768 / 1280.
 *
 *   LOGISTICA_URL=http://127.0.0.1:5173/logistica?seed=ENV-260821-001 \
 *     node scripts/e2e-logistica-viewports.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(HERE, "../public/envios-local/ENV-260821-001.json");
const SEED_RAW = fs.readFileSync(SEED_PATH, "utf8");

const URL =
  process.env.LOGISTICA_URL || "http://127.0.0.1:5173/logistica?seed=ENV-260821-001";
const OUT = process.env.SCREENSHOT_DIR || path.join(process.cwd(), "docs/team/ux-feedback/runs");

const VIEWPORTS = [
  { name: "compact-390", width: 390, height: 844, isCompact: true },
  { name: "tablet-768-portrait", width: 768, height: 1024, isCompact: false },
  { name: "tablet-768-landscape", width: 1024, height: 768, isCompact: false },
  { name: "desktop-1280", width: 1280, height: 720, isCompact: false },
];

let passed = 0;
let failed = 0;

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`);
    failed += 1;
  }
}

async function runViewport(context, vp) {
  const page = await context.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.addInitScript((seedRaw) => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && /logistica|envios/i.test(k)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      const id = "ENV-260821-001";
      localStorage.setItem("bmc-logistica-online-v2", seedRaw);
      localStorage.setItem(`bmc-logistica-draft-v1:${id}`, seedRaw);
      localStorage.setItem(
        "bmc-logistica-drafts-index-v1",
        JSON.stringify({
          v: 1,
          ids: [id],
          meta: { [id]: { savedAt: "2026-08-21T00:47:55.000Z", stopCount: 6, legCount: 0, label: id } },
        }),
      );
    } catch {
      /* ignore */
    }
  }, SEED_RAW);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".envios-app", { timeout: 20000 });
  const rutaChip = page.getByRole("button", { name: /4\s*·\s*Ruta/i });
  await rutaChip.click({ timeout: 15000 }).catch(() => {});
  const desk = page.locator('[data-testid="ruta-desk"]');
  await desk.waitFor({ state: "visible", timeout: 25000 }).catch(() => {});
  const deskVisible = await desk.isVisible().catch(() => false);
  assert(`${vp.name} mesa de ruta visible`, deskVisible);

  const overflowX = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  assert(`${vp.name} sin scroll-x (>8px)`, overflowX <= 8, `delta=${overflowX}`);

  const thumb = page.locator('[data-testid="ruta-desk-thumb"]');
  const thumbBox = await thumb.boundingBox().catch(() => null);
  const thumbCss = await thumb.evaluate((el) => getComputedStyle(el).display).catch(() => "none");
  const thumbShown = thumbCss !== "none" && !!thumbBox && thumbBox.height > 8;
  if (vp.isCompact) {
    assert(`${vp.name} thumb Recalcular visible`, thumbShown);
    if (thumbBox) {
      const inThumbZone = thumbBox.y + thumbBox.height / 2 > vp.height * 0.55;
      assert(`${vp.name} thumb en zona pulgar`, inThumbZone, `y=${thumbBox.y}`);
    }
    const primary = thumb.getByRole("button", { name: /Recalcular|Calculando/i });
    assert(`${vp.name} Recalcular en thumb`, await primary.isVisible().catch(() => false));
    await primary.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    assert(
      `${vp.name} Recalcular click no rompe desk`,
      await desk.isVisible().catch(() => false),
    );
  } else {
    assert(`${vp.name} thumb oculto (barra superior)`, !thumbShown);
    const topRecalc = page.locator(".ruta-desk-actions").getByRole("button", { name: /Recalcular|Calculando/i });
    assert(`${vp.name} Recalcular en barra`, await topRecalc.isVisible().catch(() => false));
  }

  await page.getByText("ITINERARIO").first().scrollIntoViewIfNeeded().catch(() => {});
  const handles = page.locator('[data-testid="ruta-leg-handle"]');
  await handles.first().waitFor({ state: "attached", timeout: 12000 }).catch(() => {});
  const handleCount = await handles.count();
  assert(`${vp.name} asas de reorder`, handleCount >= 1, `n=${handleCount}`);

  const map = page.locator('[data-testid="logistica-map-column"]');
  assert(`${vp.name} columna mapa`, await map.isVisible().catch(() => false));

  const itineraryCount = await page.getByText("ITINERARIO").count();
  assert(`${vp.name} itinerario`, itineraryCount >= 1, `n=${itineraryCount}`);

  const stopHint = await page.getByText(/Darío|Alvaro|Kingspan|Montfrío/i).count();
  assert(`${vp.name} paradas del seed`, stopHint >= 1, `n=${stopHint}`);

  const wizThumb = page.locator('[data-testid="envios-wizard-thumb"]');
  const inlineNav = page.locator('[data-testid="envios-wizard-inline-nav"]');
  for (const step of [
    { name: /1\s*·\s*Pedidos/i, key: "pedidos" },
    { name: /2\s*·\s*Flota/i, key: "flota" },
    { name: /3\s*·\s*Levantes/i, key: "levantes" },
  ]) {
    await page.getByRole("button", { name: step.name }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(350);
    const shell = page.locator('[data-testid="envios-wizard-shell"]');
    const active = await shell.getAttribute("data-active-step").catch(() => "");
    assert(`${vp.name} chip ${step.key}`, active === step.key, `got=${active}`);
    if (vp.isCompact) {
      const wt = await wizThumb.isVisible().catch(() => false);
      assert(`${vp.name} ${step.key} thumb Continuar`, wt);
      const cont = wizThumb.getByRole("button", { name: /Continuar/i });
      assert(`${vp.name} ${step.key} Continuar pulgar`, await cont.isVisible().catch(() => false));
    } else {
      const shown = await inlineNav.evaluate((el) => getComputedStyle(el).display !== "none").catch(() => false);
      assert(`${vp.name} ${step.key} nav inline`, shown);
    }
    if (step.key === "pedidos") {
      const q = page.locator("#log-ventas-search");
      if (await q.count()) {
        const fs = await q.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        if (vp.isCompact) assert(`${vp.name} search ≥16px`, fs >= 15.5, `fs=${fs}`);
      }
    }
    if (step.key === "flota") {
      assert(`${vp.name} Flota transportista`, await page.getByText(/Transportista/i).first().isVisible().catch(() => false));
    }
    if (step.key === "levantes") {
      assert(`${vp.name} Levantes copy`, await page.getByText(/levante/i).first().isVisible().catch(() => false));
    }
  }
  await page.getByRole("button", { name: /4\s*·\s*Ruta/i }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  assert(`${vp.name} vuelve a Ruta`, await desk.isVisible().catch(() => false));
  assert(`${vp.name} mapa persiste`, await map.isVisible().catch(() => false));

  try {
    fs.mkdirSync(OUT, { recursive: true });
    const shot = path.join(OUT, `logistica-ruta-${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });
    console.log(`  📸 ${shot}`);
  } catch (e) {
    console.log(`  ⚠ screenshot ${vp.name}: ${e.message}`);
  }

  await page.close();
}

const context = await chromium.launchPersistentContext("/tmp/pw-logistica-viewports", {
  headless: true,
  executablePath:
    process.env.PW_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  viewport: { width: 1280, height: 720 },
});
try {
  console.log(`logistica viewports → ${URL}`);
  for (const vp of VIEWPORTS) {
    console.log(`\n${vp.name} ${vp.width}×${vp.height}`);
    await runViewport(context, vp);
  }
} finally {
  await context.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
