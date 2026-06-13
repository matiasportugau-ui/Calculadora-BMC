/**
 * demo-route-smoke.mjs — verifica que TODAS las rutas de la SPA cargan sin
 * crash (pantalla blanca / excepción no atrapada), en condiciones de demo:
 * sin credenciales (Sheets/IA), sin Postgres. Rutas auth-gated que redirigen
 * a login o muestran "acceso denegado" cuentan como OK (renderizan, no crashean).
 *
 * Uso: node scripts/demo-route-smoke.mjs [--base=http://localhost:5173]
 * Requiere: Vite en :5173 y API en :3001 corriendo.
 * Exit 0 = ninguna ruta crashea. Exit 1 = al menos una crashea.
 */
import { chromium } from "playwright";

const baseArg = process.argv.slice(2).find((a) => a.startsWith("--base="));
const BASE = baseArg ? baseArg.slice(7).replace(/\/$/, "") : "http://localhost:5173";

const ROUTES = [
  "/", "/calculadora", "/especificaciones", "/fichas", "/preview/pdf",
  "/hub", "/hub/admin", "/hub/admin/analytics", "/hub/admin/users",
  "/hub/agent-admin", "/hub/bugs", "/hub/canales", "/hub/clientes",
  "/hub/cotizaciones", "/hub/marketing", "/hub/ml", "/hub/plan-import",
  "/hub/tareas", "/hub/traktime", "/hub/wa",
  "/logistica", "/conductor", "/inspector", "/mi-espacio",
  "/presentacion-licitacion", "/wa",
  "/ruta-inexistente-12345", // 404 fallback
];

// Errores de consola aceptables en demo (sin creds / sin DB / sin sesión).
const ALLOWED_CONSOLE = [
  /status of 401/, /status of 403/, /status of 404/, /status of 503/,
  /Failed to load resource/, /ERR_/, /net::/,
  /\/api\//, /\/auth\//, /Sheets/, /503/, /Unauthorized/, /Forbidden/,
];
const isAllowed = (t) => ALLOWED_CONSOLE.some((re) => re.test(t));

const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", X = "\x1b[0m";
let fails = 0;
const rows = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

console.log(`\nDemo route smoke — base: ${BASE}  (${ROUTES.length} rutas)\n`);

for (const path of ROUTES) {
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !isAllowed(m.text())) consoleErrors.push(m.text()); });

  let mounted = false, rootText = 0, status = 0;
  try {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    status = resp ? resp.status() : 0;
    await page.waitForTimeout(1800); // dejar montar React + primeras llamadas
    const info = await page.evaluate(() => {
      const root = document.getElementById("root");
      return { kids: root ? root.childElementCount : 0, text: (document.body.innerText || "").trim().length };
    });
    mounted = info.kids > 0;
    rootText = info.text;
  } catch (e) {
    pageErrors.push(`navigate: ${e.message.split("\n")[0]}`);
  }

  // CRASH = excepción no atrapada, o root vacío / pantalla en blanco.
  const whiteScreen = !mounted || rootText < 5;
  const crashed = pageErrors.length > 0 || whiteScreen;
  const hasNoise = consoleErrors.length > 0;

  if (crashed) {
    fails++;
    rows.push(`${R}✗ CRASH${X}  ${path}  ${pageErrors[0] ? "err=" + pageErrors[0].slice(0, 80) : "white-screen (root kids=0 / text<5)"}`);
  } else if (hasNoise) {
    rows.push(`${Y}! ok*  ${X}  ${path}  (render OK; ${consoleErrors.length} console err no permitido: ${consoleErrors[0].slice(0, 60)})`);
  } else {
    rows.push(`${G}✓ ok   ${X}  ${path}  (status ${status}, text ${rootText}c)`);
  }
  await page.close();
}

await browser.close();
console.log(rows.join("\n"));
console.log(`\n${fails === 0 ? G + "✓" : R + "✗"} ${ROUTES.length - fails}/${ROUTES.length} rutas sin crash${X}\n`);
process.exit(fails === 0 ? 0 : 1);
