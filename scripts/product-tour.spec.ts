/**
 * Product Tour — recorrido navegable y re-ejecutable de Calculadora-BMC.
 * ─────────────────────────────────────────────────────────────────────────────
 * Navega la app como un usuario real, completa UNA cotización demo de 11 pasos y
 * captura screenshots de cada módulo. Regenera los assets de docs/product/.
 *
 * Uso:
 *   PLAYWRIGHT_BASE_URL=https://calculadora-bmc.vercel.app \
 *   TOUR_SESSION_COOKIE='<valor del cookie bmc_sess>' \
 *   npx playwright test scripts/product-tour.spec.ts
 *
 * Sin TOUR_SESSION_COOKIE: sólo se documenta la Calculadora (pública) y los
 * módulos gateados quedan tag `[NOT OBSERVED — requiere auth]`.
 *
 * Guardarraíles (repo público, datos reales):
 *  - Demo data únicamente, prefijo [DEMO-TOUR]. Una sola cotización.
 *  - NUNCA dispara envíos de WhatsApp/ML. No toca toggles de automatización.
 *  - Read-only salvo la cotización demo.
 *  - Capturas de módulos con PII real → ./docs-private/ (gitignored), no se commitean.
 *  - El cookie/token nunca se loguea ni aparece en una captura.
 */
import { test, expect, type Page, type BrowserContext, type Browser } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const ASSETS_DIR = join(REPO_ROOT, "docs/product/assets"); // commiteable
const PRIVATE_DIR = join(REPO_ROOT, "docs-private"); // gitignored (PII)
const META_PATH = join(REPO_ROOT, "docs/product/tour-metadata.json");

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "https://calculadora-bmc.vercel.app").replace(/\/+$/, "");
const COOKIE = process.env.TOUR_SESSION_COOKIE || "";
const COOKIE_DOMAIN = new URL(BASE).hostname;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const DEMO = {
  refInterna: "[DEMO-TOUR] Cliente Demo Tour",
  nombre: "[DEMO-TOUR] Cliente Demo Tour",
  telefono: "+598 00 000 000",
  email: "demo@bmcuruguay.test",
};

// ── Registro de metadata (se vuelca a tour-metadata.json en afterAll) ─────────
type Shot = {
  module: string;
  screen: string;
  file: string; // ruta relativa a REPO_ROOT
  committed: boolean;
  pii: boolean;
  status: "ok" | "error" | "not-observed";
  note?: string;
  viewport: string;
};
const shots: Shot[] = [];
const moduleEndpoints: Record<string, Set<string>> = {};
// En el recorrido autenticado todos los módulos comparten UN solo contexto/página
// (la rotación obligatoria del refresh-token exige no reinyectar el cookie original
// en un segundo contexto — eso dispara reuse-detection y mata la sesión). Por eso el
// recorder de red apunta al módulo "activo" en vez de un listener por módulo.
let activeModule = "";

/** Marca el módulo activo cuyos endpoints registrará el recorder compartido. */
function setActiveModule(id: string) {
  activeModule = id;
  if (!moduleEndpoints[id]) moduleEndpoints[id] = new Set();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

/** Inyecta el refresh-cookie (bmc_sess) para que el SPA se autentique solo. */
async function addAuthCookie(context: BrowserContext) {
  if (!COOKIE) return false;
  await context.addCookies([
    {
      name: "bmc_sess",
      value: COOKIE,
      domain: COOKIE_DOMAIN,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
    },
  ]);
  return true;
}

/**
 * Sustituye segmentos de path que parezcan identificadores reales (teléfonos,
 * ids largos, emails) por `:id`. Defensa anti-PII para los endpoints REST que
 * incrustan datos del cliente en la ruta (p. ej. /api/wa/conversations/598…).
 */
function sanitizePath(pathname: string): string {
  return pathname
    .split("/")
    .map((seg) =>
      seg.includes("@") ||
      /^\+?\d{4,}$/.test(seg) || // teléfonos / ids numéricos
      /^[0-9a-f]{16,}$/i.test(seg) || // hashes / tokens hex
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) // UUID
        ? ":id"
        : seg,
    )
    .join("/");
}

/** Registra los endpoints (api/calc/auth/webhooks) que llama un módulo. */
function recordNetwork(page: Page, moduleId: string) {
  if (!moduleEndpoints[moduleId]) moduleEndpoints[moduleId] = new Set();
  page.on("request", (req) => {
    try {
      const u = new URL(req.url());
      if (/^\/(api|calc|auth|webhooks)\b/.test(u.pathname)) {
        moduleEndpoints[moduleId].add(`${req.method()} ${sanitizePath(u.pathname)}`);
      }
    } catch {
      /* ignore */
    }
  });
}

/** Recorder único para la página autenticada compartida: atribuye cada request al
 *  módulo activo (setActiveModule). Evita la contaminación cruzada de adjuntar un
 *  listener por módulo sobre la misma página. */
function attachSharedRecorder(page: Page) {
  page.on("request", (req) => {
    if (!activeModule) return;
    try {
      const u = new URL(req.url());
      if (/^\/(api|calc|auth|webhooks)\b/.test(u.pathname)) {
        moduleEndpoints[activeModule].add(`${req.method()} ${sanitizePath(u.pathname)}`);
      }
    } catch {
      /* ignore */
    }
  });
}

/** Navegación client-side (SPA) sin recarga: preserva el access-token en memoria y
 *  evita un nuevo /auth/refresh (clave con rotación + reuse-detection). */
async function clientNavigate(page: Page, route: string) {
  await page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

/** networkidle + settle delay antes de capturar (evita capturar mid-load). */
async function settle(page: Page, extraMs = 700) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(extraMs);
}

/** Espera explícita a que un canvas WebGL pinte (3D: LogistikBMC, Panelín). */
async function waitForCanvasPaint(page: Page, ms = 2500) {
  await page
    .locator("canvas")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {});
  await page.waitForTimeout(ms);
}

/** Captura una pantalla al directorio correcto (assets vs docs-private). */
async function snap(
  target: Page,
  opts: {
    module: string;
    screen: string;
    n: number;
    pii: boolean;
    viewport?: string;
    status?: "ok" | "error" | "not-observed";
    note?: string;
    fullPage?: boolean;
  },
) {
  const baseDir = opts.pii ? PRIVATE_DIR : ASSETS_DIR;
  const dir = join(baseDir, opts.module);
  ensureDir(dir);
  const fname = `${String(opts.n).padStart(2, "0")}-${opts.screen}.png`;
  const abs = join(dir, fname);
  const rel = abs.slice(REPO_ROOT.length + 1);
  try {
    await target.screenshot({ path: abs, fullPage: opts.fullPage ?? false });
    shots.push({
      module: opts.module,
      screen: opts.screen,
      file: rel,
      committed: !opts.pii,
      pii: opts.pii,
      status: opts.status || "ok",
      note: opts.note,
      viewport: opts.viewport || `${DESKTOP.width}x${DESKTOP.height}`,
    });
  } catch (err) {
    shots.push({
      module: opts.module,
      screen: opts.screen,
      file: rel,
      committed: false,
      pii: opts.pii,
      status: "error",
      note: `screenshot fail: ${(err as Error).message}`,
      viewport: opts.viewport || `${DESKTOP.width}x${DESKTOP.height}`,
    });
  }
}

async function newCtx(browser: Browser, viewport: { width: number; height: number }, authed: boolean) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  if (authed) await addAuthCookie(ctx);
  return ctx;
}

// ── Calculadora: cotización demo de 11 pasos ─────────────────────────────────
// Slugs de los 11 pasos (src/data/constants.js → wizardSteps solo_techo).
const STEP_SLUGS = [
  "escenario",
  "familia-panel",
  "espesor",
  "color",
  "dimensiones",
  "pendiente",
  "estructura",
  "accesorios-perimetrales",
  "selladores",
  "flete",
  "datos-proyecto",
];

/** Lee el indicador "N/11" del wizard. Null si ya no estamos en el wizard. */
async function readStepNo(page: Page): Promise<number | null> {
  const txt = await page
    .locator("#root .bmc-left-panel")
    .getByText(/\b\d+\s*\/\s*11\b/)
    .first()
    .textContent()
    .catch(() => null);
  const m = txt?.match(/(\d+)\s*\/\s*11/);
  return m ? Number(m[1]) : null;
}

/**
 * Avanza un paso de forma robusta: scrollea el panel izquierdo al fondo (el botón
 * "Siguiente" vive abajo) y espera a que el indicador "N/11" cambie. Devuelve el
 * nuevo nº de paso, o null si salimos del wizard (BOM).
 */
async function advanceStep(page: Page): Promise<number | null> {
  await page
    .evaluate(() => {
      const p = document.querySelector("#root .bmc-left-panel");
      if (p) p.scrollTop = p.scrollHeight;
    })
    .catch(() => {});
  const before = await readStepNo(page);
  const btn = page.locator("#root .bmc-left-panel").getByRole("button", { name: "Siguiente" }).last();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ force: true, timeout: 15_000 }).catch(() => {});
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(250);
    const now = await readStepNo(page);
    if (now !== before) return now;
  }
  return await readStepNo(page);
}

/** Espera a que el indicador "N/11" deje de ser `before` (o desaparezca → BOM). */
async function waitStepChange(page: Page, before: number | null, tries = 20): Promise<number | null> {
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(250);
    const now = await readStepNo(page);
    if (now !== before) return now;
  }
  return readStepNo(page);
}

/** Dimensiones: rellena largo/ancho (cadena de paneles, modo metros). */
async function fillDimensiones(page: Page) {
  const inputs = page.locator("#root .bmc-left-panel input[data-stepper-chain='1']");
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).click().catch(() => {});
    await inputs.nth(0).fill("10");
    await inputs.nth(0).press("Tab");
    await inputs.nth(1).click().catch(() => {});
    await inputs.nth(1).fill("8");
    await inputs.nth(1).press("Tab");
    await page.waitForTimeout(400);
  }
}

/** Datos del proyecto: rellena el cliente demo [DEMO-TOUR] en los campos visibles. */
async function fillProyecto(page: Page) {
  const panel = page.locator("#root .bmc-left-panel");
  const fillByLabel = async (re: RegExp, val: string) => {
    const lbl = panel.getByText(re).first();
    if (await lbl.isVisible().catch(() => false)) {
      await lbl.locator("xpath=following::input[1]").fill(val).catch(() => {});
    }
  };
  await fillByLabel(/RAZÓN SOCIAL/i, DEMO.nombre);
  await fillByLabel(/^TELÉFONO/i, DEMO.telefono);
  await fillByLabel(/NOMBRE DEL CLIENTE/i, "Cliente Demo Tour");
  await fillByLabel(/Ref\.?\s*interna/i, DEMO.refInterna);
  await page.waitForTimeout(300);
}

/** Selecciona un accesorio perimetral (gotero/cumbrera) si hay un selector abierto. */
async function pickGotero(page: Page) {
  const candidates = [
    page.getByRole("button", { name: "Gotero simple", exact: true }),
    page.getByRole("button", { name: /Gotero frontal/i }).first(),
    page.getByRole("button", { name: /Gotero Lateral/i }).first(),
    page.getByRole("button", { name: /Cumbrera/i }).first(),
    page.getByRole("button", { name: /Pretil/i }).first(),
  ];
  for (const loc of candidates) {
    if (await loc.isVisible().catch(() => false)) {
      await loc.click().catch(() => {});
      await page.waitForTimeout(100);
      return true;
    }
  }
  return false;
}

/**
 * Accesorios perimetrales (paso bordes): el botón "Siguiente" queda DESHABILITADO
 * hasta asignar al menos un accesorio. Se asignan vía la planta 2D haciendo clic en
 * cada lado y eligiendo un gotero — mínimo necesario para completar la cotización.
 */
async function assignBordes(page: Page, maxRounds = 6) {
  const svg = page.locator('[data-bmc-capture="roof-plan-2d"]').first();
  if (!(await svg.isVisible({ timeout: 20_000 }).catch(() => false))) return;
  await svg.scrollIntoViewIfNeeded().catch(() => {});
  const siguiente = page.locator("#root .bmc-left-panel").getByRole("button", { name: "Siguiente" }).last();
  for (let round = 0; round < maxRounds; round++) {
    if (!(await siguiente.isDisabled().catch(() => true))) return;
    const rects = svg.locator('[data-bmc-layer="planta-bordes-assign"] rect');
    const n = await rects.count();
    for (let i = 0; i < n; i++) {
      if (!(await siguiente.isDisabled().catch(() => true))) return;
      const box = await rects.nth(i).boundingBox();
      if (!box || box.width < 2 || box.height < 2) continue;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(100);
      await pickGotero(page);
    }
  }
}

/**
 * Recorre el wizard solo_techo (familia por defecto, modo metros) y captura cada
 * paso individualmente, guiándose por el indicador "N/11". Espejo del happy-path
 * probado: rellena dimensiones, selecciona estructura Metal, asigna un accesorio
 * perimetral (requisito para avanzar) y rellena datos del proyecto demo.
 */
async function tourCalculadora(page: Page, viewportLabel: string) {
  const mod = "02-calculadora";
  recordNetwork(page, mod);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#root .bmc-left-panel", { timeout: 30_000 });
  await settle(page, 600);

  let guard = 0;
  while (guard++ < 18) {
    const step = await readStepNo(page);
    if (step == null) break; // salimos del wizard → BOM
    const slug = STEP_SLUGS[step - 1] || `paso-${step}`;
    const panel = page.locator("#root .bmc-left-panel");

    // Acciones previas a la captura (para que el estado quede visible en la foto).
    if (slug === "dimensiones") await fillDimensiones(page);
    if (slug === "datos-proyecto") await fillProyecto(page);

    await settle(page, 500);
    await snap(page, {
      module: mod,
      screen: `paso-${String(step).padStart(2, "0")}-${slug}`,
      n: step,
      pii: false,
      viewport: viewportLabel,
    });

    // El wizard tiene 11 pasos; el último (datos del proyecto) ya muestra el BOM
    // completo en el panel derecho — no hay paso 12, así que detenemos aquí.
    if (slug === "datos-proyecto") break;

    // Selecciones por paso (algunas habilitan o auto-avanzan).
    if (slug === "escenario") {
      await panel.getByText("Solo Techo").first().click({ force: true }).catch(() => {});
    } else if (slug === "espesor") {
      await panel.getByRole("button", { name: /^\d+\s*mm$/ }).first().click().catch(() => {});
    } else if (slug === "color") {
      await page.getByRole("button", { name: /^Blanco$/ }).first().click().catch(() => {});
    } else if (slug === "estructura") {
      await page.getByRole("button", { name: "Metal", exact: true }).first().click().catch(() => {});
    } else if (slug === "accesorios-perimetrales") {
      await assignBordes(page);
    }

    // Avanzar: dar margen al auto-avance (cards) antes de cliquear "Siguiente".
    let next = await waitStepChange(page, step, 8);
    if (next === step) next = await advanceStep(page);
    if (next == null) break; // alcanzamos el BOM
  }

  // Finalizar: el botón "✓ Cotización lista" revela el presupuesto con precios y
  // los botones de exportación (WA / PDF). No envía nada.
  const listaBtn = page.getByRole("button", { name: /Cotizaci[oó]n lista/i }).first();
  if (await listaBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await listaBtn.scrollIntoViewIfNeeded().catch(() => {});
    await listaBtn.click({ force: true }).catch(() => {});
    await settle(page, 1500);
  }

  // Presupuesto / BOM resultante (con precios).
  await snap(page, { module: mod, screen: "paso-12-presupuesto-bom", n: 12, pii: false, viewport: viewportLabel, fullPage: true });

  // Pantalla de PDF presupuesto (genera vista previa; NO envía nada).
  let pdfBtn = page.locator("[data-tutorial-id='calc-generate-pdf']").first();
  if (!(await pdfBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    pdfBtn = page.getByRole("button", { name: /^PDF( Cliente)?$/i }).first();
  }
  await pdfBtn.scrollIntoViewIfNeeded().catch(() => {});
  if (await pdfBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await pdfBtn.click({ force: true }).catch(() => {});
    // Modal de PDF: "Vista previa PDF" o "Confirmar cotización" (no se confirma envío).
    await page
      .getByText(/Vista previa PDF|Confirmar cotizaci[oó]n/i)
      .first()
      .waitFor({ timeout: 15_000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await snap(page, { module: mod, screen: "paso-13-pdf-presupuesto", n: 13, pii: false, viewport: viewportLabel });
  } else {
    shots.push({
      module: mod,
      screen: "paso-13-pdf-presupuesto",
      file: "(no capturado)",
      committed: false,
      pii: false,
      status: "not-observed",
      note: "Botón PDF (data-tutorial-id=calc-generate-pdf) no visible",
      viewport: viewportLabel,
    });
  }
}

// ── Módulos autenticados ─────────────────────────────────────────────────────
type ModuleDef = {
  id: string;
  route: string;
  label: string;
  pii: boolean;
  webgl?: boolean;
};

const AUTH_MODULES: ModuleDef[] = [
  { id: "01-wolfboard", route: "/hub", label: "Wolfboard", pii: false },
  { id: "03-logistikbmc", route: "/logistica", label: "LogistikBMC", pii: false, webgl: true },
  { id: "05-cockpit-ml", route: "/hub/ml", label: "Cockpit Mercado Libre", pii: true },
  { id: "05-cockpit-wa", route: "/hub/wa", label: "Cockpit WhatsApp", pii: true },
  { id: "06-canales", route: "/hub/canales", label: "Canales", pii: true },
  { id: "07-cotizaciones", route: "/hub/cotizaciones", label: "Administrador de Cotizaciones", pii: true },
  { id: "08-traktime", route: "/hub/traktime", label: "TrakTiMe", pii: true },
  { id: "09-analytics", route: "/hub/admin/analytics", label: "Analytics", pii: false },
  { id: "10-wolf-debug", route: "/hub/bugs", label: "Wolf Debug", pii: false },
];

async function tourModule(page: Page, mod: ModuleDef) {
  setActiveModule(mod.id);
  let status: "ok" | "error" | "not-observed" = "ok";
  let note: string | undefined;
  try {
    // Navegación client-side (sin recarga) para no gatillar otro /auth/refresh.
    await clientNavigate(page, mod.route);
    await settle(page, 900);
    if (mod.webgl) await waitForCanvasPaint(page);

    // Detección de muro de auth: si seguimos anónimos, el SPA muestra gate.
    const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
    const looksGated =
      !COOKIE ||
      /iniciar sesión|inicia sesión|acceso restringido|no autorizado|403|inicia con google/i.test(bodyText);
    if (looksGated) {
      // Marcar not-observed también si el cookie está presente pero inválido/expirado
      // (si no, se commitearía una captura del muro de login como si fuera contenido real).
      status = "not-observed";
      note = COOKIE
        ? "[NOT OBSERVED — sesión inválida/expirada] el SPA muestra el muro de login pese al cookie"
        : "[NOT OBSERVED — requiere auth] sin TOUR_SESSION_COOKIE";
    }
  } catch (err) {
    status = "error";
    note = `navegación falló: ${(err as Error).message.split("\n")[0]}`;
  }
  await snap(page, {
    module: mod.id,
    screen: "principal",
    n: 1,
    pii: mod.pii,
    status,
    note,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  // Limpia capturas previas para una regeneración determinista.
  for (const d of [ASSETS_DIR, PRIVATE_DIR]) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  ensureDir(ASSETS_DIR);
  ensureDir(PRIVATE_DIR);
});

test("Calculadora — cotización demo 11 pasos (desktop)", async ({ browser }) => {
  const ctx = await newCtx(browser, DESKTOP, false);
  const page = await ctx.newPage();
  await tourCalculadora(page, `${DESKTOP.width}x${DESKTOP.height}`);
  await ctx.close();
  // Al menos los 11 pasos + BOM capturados.
  expect(shots.filter((s) => s.module === "02-calculadora" && s.status === "ok").length).toBeGreaterThanOrEqual(11);
});

test("Calculadora — vista mobile", async ({ browser }) => {
  const ctx = await newCtx(browser, MOBILE, false);
  const page = await ctx.newPage();
  recordNetwork(page, "02-calculadora");
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await settle(page, 800);
  await snap(page, {
    module: "02-calculadora",
    screen: "mobile-inicio",
    n: 20,
    pii: false,
    viewport: `${MOBILE.width}x${MOBILE.height}`,
  });
  await ctx.close();
});

/** Panelín — avatar IA 3D. No tiene ruta propia en App.jsx; se descubre vivo. */
async function discoverPanelin(page: Page) {
  const mod = "04-panelin";
  setActiveModule(mod);
  // El hub expone "Hablar con Panelín" como card/enlace (no <button>): aceptar
  // role button Y link, y el texto explícito.
  const trigger = page
    .getByRole("link", { name: /hablar con panel[ií]n|panel[ií]n/i })
    .or(page.getByRole("button", { name: /hablar con panel[ií]n|panel[ií]n|asistente/i }))
    .or(page.getByText(/hablar con panel[ií]n/i))
    .or(page.locator("[data-tutorial-id*='panelin'], [aria-label*='Panelín' i]"))
    .first();
  if (await trigger.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await trigger.click({ force: true }).catch(() => {});
    await waitForCanvasPaint(page, 2500);
    // Se abre desde el hub autenticado y puede mostrar nombre del operador o
    // fragmentos de conversación → tratar como PII (docs-private, no commitear).
    await snap(page, { module: mod, screen: "avatar", n: 1, pii: true, note: "Avatar Panelín abierto desde el hub" });
  } else {
    shots.push({
      module: mod,
      screen: "avatar",
      file: "(no capturado)",
      committed: false,
      pii: true,
      status: "not-observed",
      note: "[NOT OBSERVED] No se encontró trigger de Panelín en /hub; sin ruta propia en App.jsx",
      viewport: `${DESKTOP.width}x${DESKTOP.height}`,
    });
  }
}

test("Recorrido autenticado — Wolfboard + módulos", async ({ browser }) => {
  // UN SOLO contexto/página para todo el recorrido autenticado. El refresh-token
  // rota en cada /auth/refresh y reusar uno viejo dispara reuse-detection (mata la
  // sesión). Por eso: inyectamos el cookie una vez, hacemos UNA recarga real (/hub,
  // que gatilla el único refresh del SPA) y luego navegamos client-side.
  const ctx = await newCtx(browser, DESKTOP, true);
  const page = await ctx.newPage();
  attachSharedRecorder(page);

  setActiveModule("01-wolfboard");
  await page.goto(BASE + "/hub", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await settle(page, 1500);

  // ¿Autenticó? Si el SPA sigue mostrando el muro de login, el cookie es inválido o
  // ya fue consumido (rotación) → marcamos todos los módulos not-observed y salimos.
  const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
  const gated = /iniciar sesión|inicia sesión|inicia con google|acceso restringido/i.test(bodyText);
  if (gated) {
    const note = COOKIE
      ? "[NOT OBSERVED — sesión inválida/expirada/rotada] el SPA muestra el muro de login pese al cookie"
      : "[NOT OBSERVED — requiere auth] sin TOUR_SESSION_COOKIE";
    for (const mod of [{ id: "01-wolfboard", pii: false }, { id: "04-panelin", pii: true }, ...AUTH_MODULES.slice(1)]) {
      shots.push({
        module: mod.id, screen: "principal", file: "(no capturado)",
        committed: false, pii: mod.pii, status: "not-observed", note,
        viewport: `${DESKTOP.width}x${DESKTOP.height}`,
      });
    }
    await ctx.close();
    return;
  }

  // Wolfboard (hub) — desktop.
  await snap(page, { module: "01-wolfboard", screen: "principal", n: 1, pii: false });

  // Wolfboard — mobile (misma página/sesión, sólo cambia el viewport; sin recarga).
  await page.setViewportSize(MOBILE);
  await settle(page, 700);
  await snap(page, { module: "01-wolfboard", screen: "mobile", n: 20, pii: false, viewport: `${MOBILE.width}x${MOBILE.height}` });
  await page.setViewportSize(DESKTOP);
  await settle(page, 400);

  // Panelín (avatar) — best-effort desde el hub.
  await discoverPanelin(page);

  // Resto de módulos vía navegación client-side (sin recargas → sin más refreshes).
  for (const mod of AUTH_MODULES.slice(1)) {
    await tourModule(page, mod);
  }

  await ctx.close();
});

test.afterAll(() => {
  ensureDir(dirname(META_PATH));
  const endpoints: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(moduleEndpoints)) endpoints[k] = [...v].sort();
  const meta = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    authenticated: Boolean(COOKIE),
    shotCount: shots.length,
    committedCount: shots.filter((s) => s.committed && s.status === "ok").length,
    privateCount: shots.filter((s) => s.pii && s.status === "ok").length,
    notObserved: shots.filter((s) => s.status === "not-observed").map((s) => `${s.module}/${s.screen}`),
    shots,
    endpoints,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  // Resumen en consola (sin valores sensibles).
  console.log(
    `\nProduct tour: ${meta.shotCount} capturas (${meta.committedCount} commiteables, ${meta.privateCount} en docs-private), auth=${meta.authenticated}`,
  );
});
