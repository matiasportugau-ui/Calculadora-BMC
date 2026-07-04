/**
 * Gate E2E: capa game-like LG (ScenarioCards + PriceHUD) — aislamiento ON/OFF.
 *
 * Gate ON (?designPreview=1): overlay con cartas de escenario → click camara_frig
 * → overlay cierra, HUD montado. Gate OFF (/): CERO nodos LG en el DOM, CERO
 * chunks LG pedidos por red, CERO requests de fuentes LG (Archivo/JetBrains).
 *
 * Nota: NO correr contra producción — isDesignPreviewEnabled() es false en
 * VERCEL_ENV=production, así que el lado ON solo funciona en local/preview.
 *
 * Uso:
 *   npm run test:playwright:lgq                                  (default :4173, vite preview)
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:playwright:lgq
 *   LGQ_BLOCK_FONTS=1 npm run test:playwright:lgq                (simula CDN de fuentes caída)
 */
import { chromium } from "playwright";

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");
const BLOCK_FONTS = process.env.LGQ_BLOCK_FONTS === "1";
const LG_CHUNK_RE = /ScenarioCards|PriceHUD|lg-quoter|lgFonts/i;
const LG_FONT_RE = /fonts\.(googleapis|gstatic)\.com.*(Archivo|JetBrains)/i;

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function newPage(browser, counters) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("request", (r) => {
    const url = r.url();
    if (LG_CHUNK_RE.test(url) && url.includes("/assets/")) counters.chunks.push(url);
    if (LG_FONT_RE.test(url)) counters.fonts.push(url);
  });
  if (BLOCK_FONTS) {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort("connectionreset"));
  }
  return page;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    // Sandboxes con Chromium pre-instalado (p.ej. Claude Code remoto) pueden
    // apuntar acá en vez de correr `playwright install`.
    executablePath: process.env.LGQ_CHROMIUM_PATH || undefined,
  });
  try {
    // ── Gate ON ─────────────────────────────────────────────────
    const on = { chunks: [], fonts: [] };
    let page = await newPage(browser, on);
    await page.goto(`${BASE}/?designPreview=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('[data-testid="lgq-scenarios"]', { timeout: 30_000 });
    check("ON: overlay de escenarios visible", true);

    const cards = await page.locator('[data-testid^="lgq-card-"]').count();
    check("ON: cartas de escenario", cards >= 4, `${cards} cartas`);

    await page.click('[data-testid="lgq-card-camara_frig"]');
    await page.waitForSelector('[data-testid="lgq-hud"]', { timeout: 30_000 });
    const overlayGone = (await page.locator('[data-testid="lgq-scenarios"]').count()) === 0;
    check("ON: selección cierra overlay y monta HUD", overlayGone);
    check("ON: chunks LG pedidos por red", on.chunks.length > 0, `${on.chunks.length} chunks`);
    await page.close();

    // ── Gate OFF ────────────────────────────────────────────────
    const off = { chunks: [], fonts: [] };
    page = await newPage(browser, off);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector('[data-tutorial-id="calc-main"]', { timeout: 30_000 });
    await page.waitForTimeout(3000); // margen para lazy loads espurios
    const lgNodes = await page.locator('[data-lg-quoter], [data-testid^="lgq-"]').count();
    check("OFF: cero nodos LG en el DOM", lgNodes === 0, `${lgNodes} nodos`);
    check("OFF: cero chunks LG pedidos", off.chunks.length === 0, off.chunks.join(", ") || "0");
    check("OFF: cero requests de fuentes LG", off.fonts.length === 0, off.fonts.join(", ") || "0");
    check("OFF: calculadora renderiza normal", true);
    await page.close();
  } catch (e) {
    check("ejecución sin excepciones", false, String(e).slice(0, 300));
  } finally {
    await browser.close();
  }

  console.log(failures === 0 ? `\nLG GATE: PASS (${BASE})` : `\nLG GATE: FAIL — ${failures} chequeo(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
