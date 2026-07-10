/**
 * Verificación de aislamiento lazy-chunk: Visor 3D · Paneles para cubierta.
 *
 * Prueba sobre el build real (dist/ + `vite preview`), no sobre el dev server:
 *   A. Gate OFF (`/` sin designPreview): cero requests de chunks del visor 3D
 *      (RoofPanelRealisticScene / Roof3DSection / roof3d) y la sección no existe
 *      en el DOM. NOTA: NO se asierta ausencia de vendor-three — el quoter lo
 *      importa estáticamente hoy (RoofBorderCanvas legacy), condición preexistente.
 *   B. Gate ON (`/?designPreview=1`): la sección aparece colapsada; el chunk de
 *      la escena NO se pide hasta expandir; al expandir se pide y monta
 *      (placeholder data-bmc-state="empty" con zonas 0×0 iniciales).
 *   C. Con dimensiones reales (wizard hasta 6×5): data-bmc-state="canvas" y
 *      <canvas> presente dentro de la sección.
 *
 * Gotcha crítico: vite-plugin-pwa precachea **\/*.js — el service worker pediría
 * el chunk de la escena por su cuenta y falsearía el caso A. Se bloquea con
 * serviceWorkers: "block" en el contexto.
 *
 * Uso:
 *   node scripts/playwright-roof3d-lazy-chunk.mjs            (build + preview + test)
 *   node scripts/playwright-roof3d-lazy-chunk.mjs --skip-build   (reusa dist/)
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const PORT = process.env.ROOF3D_PREVIEW_PORT || "4173";
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 1400, height: 900 };
const CHUNK_RE = /RoofPanelRealisticScene|Roof3DSection|roof3d/i;
// WebGL por software en Chromium headless (sin GPU): swiftshader.
const GL_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

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

function buildDist() {
  console.log("── Build de producción (gate OFF en el bundle) ──");
  const res = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      BMC_DISK_PRECHECK_SKIP: "1",
      // Defensa: aunque .env lo tenga activo, el bundle de esta prueba
      // debe quedar con el gate apagado por defecto.
      VITE_BMC_DESIGN_PREVIEW: "",
    },
  });
  if (res.status !== 0) {
    console.error("FATAL: npm run build falló");
    process.exit(1);
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* aún no arriba */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`vite preview no respondió en ${url} tras ${timeoutMs}ms`);
}

function collectJsRequests(page, sink) {
  page.on("request", (req) => {
    const url = req.url();
    if (/\.js(\?|$)/.test(url)) sink.push(url);
  });
}

async function waitForQuoter(page) {
  // El visor 2D del panel derecho es el ancla estable del quoter cargado
  // (el wizard vendedor no tiene botón "Siguiente" en el paso inicial).
  await page.waitForSelector("text=Visor visual · Paneles para cubierta", { timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
}

function roof3dHeader(page) {
  return page.getByRole("button", { name: "Visor 3D · Paneles para cubierta" });
}

async function launchChromium() {
  // Cadena de fallbacks: Chrome del sistema → Chromium de Playwright →
  // binario explícito (entornos cloud/CI con browser preinstalado en otra ruta).
  try {
    return await chromium.launch({ channel: "chrome", headless: true, args: GL_ARGS });
  } catch {
    /* sin Chrome de sistema */
  }
  try {
    return await chromium.launch({ headless: true, args: GL_ARGS });
  } catch (err) {
    const candidates = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, "/opt/pw-browsers/chromium"].filter(Boolean);
    for (const executablePath of candidates) {
      if (fs.existsSync(executablePath)) {
        return chromium.launch({ executablePath, headless: true, args: GL_ARGS });
      }
    }
    throw err;
  }
}

async function main() {
  if (!process.argv.includes("--skip-build")) buildDist();

  console.log("\n── Sanity estático sobre dist/ ──");
  const assets = fs.existsSync("dist/assets") ? fs.readdirSync("dist/assets") : [];
  const sceneChunks = assets.filter((f) => /^RoofPanelRealisticScene-.*\.js$/.test(f));
  assert("La escena 3D es su propio chunk Rollup", sceneChunks.length === 1, `hallados: ${sceneChunks.join(", ") || "ninguno"}`);
  const wrapperChunks = assets.filter((f) => /Roof3DSection/i.test(f));
  assert("Roof3DSection no genera chunk propio (va estático en el quoter)", wrapperChunks.length === 0, wrapperChunks.join(", "));

  console.log("\n── Sirviendo dist/ con vite preview ──");
  const server = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", PORT, "--strictPort"], {
    stdio: "ignore",
  });
  let browser;
  try {
    await waitForServer(`${BASE}/`);

    browser = await launchChromium();
    // serviceWorkers: "block" — ver gotcha PWA en el encabezado.
    const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: "block" });

    // ═══ CASO A: gate OFF ═══
    console.log("\n═══ CASO A — gate OFF: cero bytes del visor 3D ═══");
    {
      const jsRequests = [];
      const page = await context.newPage();
      collectJsRequests(page, jsRequests);
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForQuoter(page);
      const offenders = jsRequests.filter((u) => CHUNK_RE.test(u));
      assert("Sin requests de chunks roof3d con gate apagado", offenders.length === 0, offenders.join(", "));
      const headerCount = await roof3dHeader(page).count();
      assert("Sección 'Visor 3D' ausente del DOM con gate apagado", headerCount === 0);
      await page.close();
    }

    // ═══ CASO B: gate ON, lazy hasta expandir ═══
    console.log("\n═══ CASO B — gate ON: chunk sólo al expandir ═══");
    const jsRequests = [];
    const page = await context.newPage();
    collectJsRequests(page, jsRequests);
    await page.goto(`${BASE}/?designPreview=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForQuoter(page);

    const header = roof3dHeader(page);
    assert("Sección 'Visor 3D' visible con gate encendido", await header.isVisible().catch(() => false));
    assert(
      "Chunk de la escena NO pedido mientras está colapsada",
      !jsRequests.some((u) => /RoofPanelRealisticScene/i.test(u)),
    );

    await header.scrollIntoViewIfNeeded();
    const chunkReq = page
      .waitForRequest((r) => /RoofPanelRealisticScene/i.test(r.url()), { timeout: 15000 })
      .catch(() => null);
    await header.click();
    assert("Chunk de la escena se pide al expandir", (await chunkReq) !== null);
    const emptyState = page.locator('[data-bmc-component="Roof3DSection"] [data-bmc-state="empty"]');
    assert(
      "Escena monta con placeholder (zonas iniciales 0×0)",
      await emptyState.isVisible({ timeout: 15000 }).catch(() => false),
    );

    // ═══ CASO C: canvas con zonas reales ═══
    // El wizard vendedor avanza con click en tarjetas + Enter (sin botón
    // "Siguiente"): escenario → familia (click ISODEC EPS) → espesor (Enter,
    // default) → color (Enter, default) → dimensiones (chain inputs).
    console.log("\n═══ CASO C — dimensiones 6×5: canvas 3D ═══");
    await page.getByText("Asistente paso a paso").first().click(); // escenario → familia
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /ISODEC EPS/i }).first().click(); // familia → espesor
    await page.waitForTimeout(600);
    await page.keyboard.press("Enter"); // espesor → color
    await page.waitForTimeout(600);
    await page.keyboard.press("Enter"); // color → dimensiones
    const chainInputs = page.locator("input[data-stepper-chain='1']");
    await chainInputs.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    if ((await chainInputs.count()) >= 2) {
      await chainInputs.nth(0).click();
      await chainInputs.nth(0).fill("6");
      await chainInputs.nth(0).press("Tab");
      await chainInputs.nth(1).click();
      await chainInputs.nth(1).fill("5");
      await chainInputs.nth(1).press("Tab");
      await page.waitForTimeout(400);
    } else {
      assert("Inputs de dimensiones encontrados", false, "input[data-stepper-chain='1'] < 2");
    }

    const canvasState = page.locator('[data-bmc-component="Roof3DSection"] [data-bmc-state="canvas"]');
    assert(
      "Escena pasa a estado canvas con zonas 6×5",
      await canvasState.isVisible({ timeout: 20000 }).catch(() => false),
    );
    const canvasCount = await page.locator('[data-bmc-component="Roof3DSection"] canvas').count();
    assert("<canvas> WebGL presente dentro de la sección", canvasCount >= 1, `count: ${canvasCount}`);
    const noWebgl = await page.locator('[data-bmc-component="Roof3DSection"] [data-bmc-state="no-webgl"]').count();
    assert("Sin fallback no-webgl (swiftshader activo)", noWebgl === 0, "revisar GL_ARGS / soporte WebGL headless");

    await page.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`════════════════════════════════════════\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
