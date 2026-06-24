/**
 * Admin de Cotizaciones v2 — walkthrough + tutorial source generator (Playwright/Chromium).
 *
 * Walks every flow of /hub/cotizaciones, captures one screenshot per step,
 * and emits a structured JSON file under docs/walkthrough/admin-cot/source.json
 * with the raw material for tooltips / "?" buttons / popup tips (Phase 2).
 *
 * Uso:
 *   # 1) En otra terminal levantar dev:full con la flag on
 *   VITE_FEATURE_ADMIN_COT_V2=true npm run dev:full
 *
 *   # 2) Correr el walkthrough
 *   node scripts/playwright-admin-cot-walkthrough.mjs
 *
 *   # Variantes
 *   HEADED=1 node scripts/playwright-admin-cot-walkthrough.mjs   # browser visible (debug)
 *   BMC_COCKPIT_TOKEN=<token> node scripts/playwright-admin-cot-walkthrough.mjs   # con token
 *
 * Env:
 *   PLAYWRIGHT_BASE_URL   default http://127.0.0.1:5173
 *   BMC_COCKPIT_TOKEN     si se setea, se inyecta en localStorage[bmc_cockpit_token] antes de cargar la page
 *                         (sin token → "modo dry": skipea flows que requieren backend pero igual
 *                          captura el panel de token y genera el JSON)
 *   HEADED                "1" → headless: false
 */

import { chromium } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "docs/walkthrough/admin-cot");
const SHOTS_DIR = join(OUT_DIR, "screenshots");
const SOURCE_JSON = join(OUT_DIR, "source.json");

const BASE = (process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const URL = `${BASE}/hub/cotizaciones`;
const TOKEN = process.env.BMC_COCKPIT_TOKEN || "";
const HEADED = process.env.HEADED === "1";

mkdirSync(SHOTS_DIR, { recursive: true });

/* ------------------------------------------------------------------ *
 * RECORDS                                                            *
 * ------------------------------------------------------------------ */
const records = [];
let stepIdx = 0;

async function step(meta, body) {
  stepIdx += 1;
  const started = Date.now();
  const id = meta.id;
  const screenshot = `screenshots/${String(stepIdx).padStart(2, "0")}-${id}.png`;
  const shotPath = join(OUT_DIR, screenshot);
  let status = "ok";
  let errorMsg = null;
  let boundingBox = null;
  try {
    const result = await body(shotPath);
    if (result && typeof result === "object" && result.boundingBox) {
      boundingBox = result.boundingBox;
    }
    if (result && result.status) status = result.status;
  } catch (err) {
    status = meta.optional ? "skipped" : "fail";
    errorMsg = err?.message || String(err);
    if (!meta.optional) console.error(`  ✗ ${id}:`, errorMsg);
  }
  const durationMs = Date.now() - started;
  const tag = status === "ok" ? "OK" : status === "skipped" ? "SKIP" : "FAIL";
  const line = `  ${tag.padEnd(4)} ${id.padEnd(34)} ${durationMs}ms`;
  console.log(line);
  records.push({
    id,
    intent: meta.intent,
    selector: meta.selector || null,
    helpType: meta.helpType || null,
    helpText: meta.helpText || null,
    screenshot,
    status,
    error: errorMsg,
    durationMs,
    boundingBox,
  });
  if (status === "fail" && !meta.optional) {
    throw new Error(`step ${id} failed (non-optional): ${errorMsg}`);
  }
}

async function snap(target, shotPath) {
  // target = page or Locator
  if (target.screenshot) {
    await target.screenshot({ path: shotPath });
  } else {
    await target.page().screenshot({ path: shotPath, fullPage: false });
  }
}

async function boxOf(locator) {
  try {
    const box = await locator.boundingBox();
    return box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ *
 * MAIN                                                               *
 * ------------------------------------------------------------------ */
async function main() {
  console.log(`▶ admin-cot walkthrough  base=${BASE}  token=${TOKEN ? "yes" : "DRY"}  headed=${HEADED}`);
  const browser = await chromium.launch({ channel: "chrome", headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();

  // Seed token before first goto so the module finds it on mount
  if (TOKEN) {
    await page.addInitScript((tok) => {
      try { localStorage.setItem("bmc_cockpit_token", tok); } catch {}
    }, TOKEN);
  }

  try {
    /* ------------------ Open & topbar ------------------ */
    await step(
      {
        id: "open-page",
        intent: "Aterrizar en /hub/cotizaciones y confirmar que el módulo monta",
        selector: "div.adminCot",
        helpType: "callout",
        helpText: {
          short: "Administrador de Cotizaciones",
          long: "Este tablero gestiona las cotizaciones en estado pendiente de respuesta. Lee directamente de la pestaña Admin. de la planilla y permite editar, aprobar, marcar como enviadas o generar respuestas IA en lote.",
        },
      },
      async (shot) => {
        await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
        const root = page.locator("div.adminCot").first();
        await root.waitFor({ state: "visible", timeout: 20_000 });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await page.screenshot({ path: shot, fullPage: false });
        return { boundingBox: await boxOf(root) };
      }
    );

    await step(
      {
        id: "topbar-breadcrumb",
        intent: "Confirmar breadcrumb BMC › hub › cotizaciones",
        selector: 'nav[aria-label="Breadcrumb"]',
        helpType: "tooltip",
        helpText: {
          short: "Estás en BMC → hub → cotizaciones",
          long: "El breadcrumb te ubica dentro del Hub de BMC. Hacé click en 'hub' para volver al menú de módulos.",
        },
      },
      async (shot) => {
        const crumb = page.locator('nav[aria-label="Breadcrumb"]').first();
        await crumb.waitFor({ state: "visible" });
        await crumb.screenshot({ path: shot });
        return { boundingBox: await boxOf(crumb) };
      }
    );

    await step(
      {
        id: "topbar-live",
        intent: "Chip En vivo / Procesando / Error indica el estado de la sesión",
        selector: ".adminCot__live",
        helpType: "tooltip",
        helpText: {
          short: "Indicador de conexión y actividad",
          long: "Verde = lista cargada y lista para operar. Amarillo pulsante = corriendo una acción (batch, sync, marcar enviada). Rojo = error de conexión o token inválido.",
        },
      },
      async (shot) => {
        const live = page.locator(".adminCot__live").first();
        await live.waitFor({ state: "visible" });
        await live.screenshot({ path: shot });
        return { boundingBox: await boxOf(live) };
      }
    );

    await step(
      {
        id: "topbar-kbd-hint",
        intent: "Botón ⌘K abre la paleta de comandos",
        selector: 'button.adminCot__kbd',
        helpType: "first-time-tip",
        helpText: {
          short: "Cmd/Ctrl + K abre la paleta",
          long: "La paleta de comandos te deja correr cualquier acción (refresh, generar IA, sync, export, cambiar skin) sin sacar las manos del teclado.",
        },
      },
      async (shot) => {
        const kbd = page.locator("button.adminCot__kbd").first();
        await kbd.waitFor({ state: "visible" });
        await kbd.screenshot({ path: shot });
        return { boundingBox: await boxOf(kbd) };
      }
    );

    /* ------------------ Token state ------------------ */
    const hasToken = await page.locator(".adminCot__stats").first().isVisible().catch(() => false);
    const tokenPanelVisible = await page.locator("text=Cockpit token").first().isVisible().catch(() => false);

    if (!hasToken) {
      await step(
        {
          id: "token-panel",
          intent: "Sin token → el panel de Cockpit token se muestra automáticamente",
          selector: ".adminCot__card",
          helpType: "callout",
          helpText: {
            short: "Pegá el token del cockpit para empezar",
            long: "El token autoriza las llamadas al backend /api/wolfboard/*. En prod usa JWT de identidad (login); en dev podés pegar API_AUTH_TOKEN a mano y guardarlo (localStorage).",
          },
          optional: true,
        },
        async (shot) => {
          const panel = page.locator(".adminCot__card").first();
          await panel.waitFor({ state: "visible", timeout: 5000 });
          await panel.screenshot({ path: shot });
          return { boundingBox: await boxOf(panel) };
        }
      );
      console.log("  ⚠  modo DRY: sin token, se saltan flows con backend.");
    }

    if (hasToken) {
      /* ------------------ KPIs ------------------ */
      const kpiDefs = [
        { id: "kpi-pendientes", label: "Pendientes",
          helpText: { short: "Filas con consulta sin respuesta o sin enviar",
                      long: "Cuenta filas con consulta (col I) que aún no fueron marcadas como Aprobadas o Enviadas. Es el embudo principal del administrador." } },
        { id: "kpi-aprobadas", label: "Aprobadas",
          helpText: { short: "Respuestas IA aprobadas por un humano",
                      long: "Filas marcadas con estado 'Aprobado' (col L). Listas para enviar al cliente." } },
        { id: "kpi-error", label: "Con error ⚠",
          helpText: { short: "Respuestas IA con error",
                      long: "Filas donde la respuesta IA (col J) empieza con ⚠. Suele significar que faltó contexto o la consulta era ambigua — revisalas a mano antes de aprobar." } },
        { id: "kpi-stale", label: "≥14 días sin enviar",
          helpText: { short: "Cotizaciones envejecidas que conviene cerrar",
                      long: "Filas con más de 14 días desde la consulta sin marcarse como enviadas. Alta prioridad: si no se cierran, perdés contexto del cliente y la oportunidad." } },
      ];
      for (const k of kpiDefs) {
        await step(
          {
            id: k.id,
            intent: `KPI: ${k.label}`,
            selector: `.adminCot__stat:has(.adminCot__stat-label:text-is("${k.label}"))`,
            helpType: "tooltip",
            helpText: k.helpText,
          },
          async (shot) => {
            const stat = page.locator(".adminCot__stat", { hasText: k.label }).first();
            await stat.waitFor({ state: "visible", timeout: 5000 });
            await stat.scrollIntoViewIfNeeded();
            await stat.hover();
            await stat.screenshot({ path: shot });
            return { boundingBox: await boxOf(stat) };
          }
        );
      }

      /* ------------------ Toolbar ------------------ */
      await step(
        {
          id: "toolbar-search",
          intent: "Búsqueda client-side por cliente, consulta o teléfono",
          selector: 'input[aria-label="Buscar"]',
          helpType: "tooltip",
          helpText: {
            short: "Filtra las filas ya cargadas",
            long: "El filtro funciona client-side sobre las filas leídas de la planilla. No vuelve a llamar al backend.",
          },
        },
        async (shot) => {
          const search = page.getByRole("searchbox", { name: /Buscar/i });
          await search.fill("constructora");
          await page.waitForTimeout(200);
          await search.screenshot({ path: shot });
          await search.fill("");
          return { boundingBox: await boxOf(search) };
        }
      );

      await step(
        {
          id: "toolbar-scope-admin",
          intent: "Cambiar alcance a 'Toda la planilla' carga filas sin filtrar por col I",
          selector: 'button.adminCot__pill[aria-pressed="true"]',
          helpType: "tooltip",
          helpText: {
            short: "Con consulta vs Toda la planilla",
            long: "'Con consulta' (default) solo muestra filas con texto en col I. 'Toda la planilla' lee todo el rango A2:M, útil para auditar filas viejas o vacías.",
          },
        },
        async (shot) => {
          const scopeAdmin = page.getByRole("button", { name: "Toda la planilla" });
          await scopeAdmin.click();
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          await scopeAdmin.screenshot({ path: shot });
          // back to default
          await page.getByRole("button", { name: "Con consulta" }).click();
          await page.waitForLoadState("networkidle").catch(() => {});
          return { boundingBox: await boxOf(scopeAdmin) };
        }
      );

      const statusPills = [
        { id: "toolbar-status-pendientes", label: "Pendientes",
          helpText: { short: "Solo filas pendientes de respuesta",
                      long: "Esconde Aprobadas y Enviadas. Útil para focalizar el trabajo del día." } },
        { id: "toolbar-status-error",      label: "Con error",
          helpText: { short: "Filas con respuesta IA ⚠",
                      long: "Muestra solo filas donde el batch IA falló. Suelen necesitar edición manual antes de aprobar." } },
        { id: "toolbar-status-stale",      label: "+14d",
          helpText: { short: "Cotizaciones envejecidas",
                      long: "Filas con consulta hace ≥14 días que siguen abiertas. Cerralas o archivalas." } },
      ];
      for (const p of statusPills) {
        await step(
          {
            id: p.id,
            intent: `Filtro de estado: ${p.label}`,
            selector: `button.adminCot__pill[aria-pressed="true"]:text-is("${p.label}")`,
            helpType: "tooltip",
            helpText: p.helpText,
          },
          async (shot) => {
            const pill = page.getByRole("button", { name: p.label, exact: true }).first();
            await pill.click();
            await page.waitForTimeout(200);
            await pill.screenshot({ path: shot });
            return { boundingBox: await boxOf(pill) };
          }
        );
      }
      // back to Todas
      await page.getByRole("button", { name: "Todas", exact: true }).click().catch(() => {});

      /* ------------------ Table actions ------------------ */
      await step(
        {
          id: "table-row-health",
          intent: "Indicador de salud de la fila (color)",
          selector: ".adminCot__health",
          helpType: "tooltip",
          helpText: {
            short: "Verde / amarillo / rojo según urgencia",
            long: "Verde = fresca (<7d). Amarillo = en camino (7–13d). Rojo = atrasada (≥14d) o con error. El color reemplaza la edad como señal visual rápida.",
          },
          optional: true,
        },
        async (shot) => {
          const health = page.locator(".adminCot__health").first();
          await health.waitFor({ state: "visible", timeout: 4000 });
          await health.scrollIntoViewIfNeeded();
          await health.screenshot({ path: shot });
          return { boundingBox: await boxOf(health) };
        }
      );

      await step(
        {
          id: "row-edit-drawer",
          intent: "Click en Editar abre el drawer lateral con J/K/M editables",
          selector: 'aside.adminCot__drawer',
          helpType: "callout",
          helpText: {
            short: "Editor de fila",
            long: "Editás los 3 campos clave: Respuesta IA (J), Link presupuesto (K), Replay JSON (M). Guardar persiste al sheet via POST /api/wolfboard/row.",
          },
          optional: true,
        },
        async (shot) => {
          const editBtn = page.getByRole("button", { name: "Editar", exact: true }).first();
          await editBtn.waitFor({ state: "visible", timeout: 4000 });
          await editBtn.click();
          const drawer = page.locator("aside.adminCot__drawer");
          await drawer.waitFor({ state: "visible", timeout: 4000 });
          await page.screenshot({ path: shot, fullPage: false });
          return { boundingBox: await boxOf(drawer) };
        }
      );

      await step(
        {
          id: "drawer-regenerate-hint",
          intent: "Hint explicando que regenerar IA es batch-only (limitación backend)",
          selector: ".adminCot__hint",
          helpType: "inline-?",
          helpText: {
            short: "Por qué no hay 'Regenerar IA' por fila",
            long: "El endpoint /api/wolfboard/quote-batch del backend procesa todas las filas pendientes en una sola pasada — no acepta un rowNum específico. Para regenerar una fila, vaciá su respuesta y corré Generar IA desde la barra superior.",
          },
          optional: true,
        },
        async (shot) => {
          const hint = page.locator(".adminCot__hint").first();
          await hint.waitFor({ state: "visible", timeout: 3000 });
          await hint.scrollIntoViewIfNeeded();
          await hint.screenshot({ path: shot });
          return { boundingBox: await boxOf(hint) };
        }
      );

      await step(
        {
          id: "drawer-close",
          intent: "Cerrar drawer sin guardar (Cancelar o Escape)",
          selector: 'button[aria-label="Cerrar"]',
          helpType: "tooltip",
          helpText: {
            short: "Escape o Cancelar cierran sin guardar",
            long: "Si tocaste algo y querés descartarlo, Escape cierra inmediato. Guardar persiste y cierra; Aprobar marca Aprobado y cierra.",
          },
          optional: true,
        },
        async (shot) => {
          const close = page.getByRole("button", { name: "Cerrar" }).first();
          await close.waitFor({ state: "visible", timeout: 2000 });
          await close.screenshot({ path: shot });
          await close.click();
          return { boundingBox: await boxOf(close) };
        }
      );

      await step(
        {
          id: "row-kebab",
          intent: "Kebab por fila: Aprobar, Abrir PDF, Replay, Abrir en Sheet",
          selector: ".adminCot__kebab-menu",
          helpType: "tooltip",
          helpText: {
            short: "Acciones secundarias por fila",
            long: "Las acciones primarias (Editar / Marcar enviado) están inline. El kebab agrupa lo demás: Aprobar (sin abrir drawer), abrir PDF en pestaña nueva, ver replay JSON, saltar a la fila en Google Sheet.",
          },
          optional: true,
        },
        async (shot) => {
          const kebab = page.getByRole("button", { name: "Más acciones" }).first();
          await kebab.waitFor({ state: "visible", timeout: 3000 });
          await kebab.click();
          const menu = page.locator(".adminCot__kebab-menu").first();
          await menu.waitFor({ state: "visible", timeout: 2000 });
          await page.screenshot({ path: shot, fullPage: false });
          // close kebab
          await page.keyboard.press("Escape").catch(() => {});
          await page.mouse.click(10, 10).catch(() => {});
          return { boundingBox: await boxOf(menu) };
        }
      );

      /* ------------------ Bulk + batch + sync ------------------ */
      await step(
        {
          id: "bulk-select",
          intent: "Seleccionar 2 filas → aparece la bulkbar con acción en serie",
          selector: ".adminCot__bulkbar",
          helpType: "first-time-tip",
          helpText: {
            short: "Selección múltiple",
            long: "Cuando seleccionás ≥1 fila, aparece la barra de acciones en serie. 'Marcar enviadas en serie' borra del Admin en orden descendente (preserva índices del sheet).",
          },
          optional: true,
        },
        async (shot) => {
          const checks = page.locator('input[type="checkbox"][aria-label^="Seleccionar fila"]');
          const n = await checks.count();
          if (n < 2) throw new Error("not enough rows to bulk-select");
          await checks.nth(0).check();
          await checks.nth(1).check();
          const bar = page.locator(".adminCot__bulkbar");
          await bar.waitFor({ state: "visible", timeout: 3000 });
          await bar.screenshot({ path: shot });
          // uncheck
          await checks.nth(0).uncheck();
          await checks.nth(1).uncheck();
          return { boundingBox: await boxOf(bar) };
        }
      );

      await step(
        {
          id: "batch-modal",
          intent: "Modal de Generar IA en lote (4 flags)",
          selector: ".adminCot__modal",
          helpType: "callout",
          helpText: {
            short: "Genera respuestas IA para todas las filas pendientes",
            long: "Forzar = reprocesa filas con ⚠. SyncCRM = propaga a CRM. CrearCRM = crea fila si no hay match. SyncLink = escribe link de presupuesto en col AH del CRM. Tus selecciones se persisten en localStorage.",
          },
          optional: true,
        },
        async (shot) => {
          const btn = page.getByRole("button", { name: /Generar IA/i });
          await btn.click();
          const modal = page.locator(".adminCot__modal");
          await modal.waitFor({ state: "visible", timeout: 3000 });
          await modal.screenshot({ path: shot });
          // cancel without running
          await page.getByRole("button", { name: "Cancelar", exact: true }).click();
          return { boundingBox: await boxOf(modal) };
        }
      );

      await step(
        {
          id: "toolbar-sync",
          intent: "Sync CRM → propaga Admin.J → CRM.AF (bulk, sin opciones)",
          selector: 'button:has-text("Sync CRM")',
          helpType: "tooltip",
          helpText: {
            short: "Sincroniza respuestas IA al CRM",
            long: "Llama a /api/wolfboard/sync. Para cada fila con respuesta IA (J), busca un match en CRM_Operativo por correlation ID o texto de consulta y escribe la respuesta en AF y el link en AH. Sin opciones — bulk only.",
          },
          optional: true,
        },
        async (shot) => {
          const btn = page.getByRole("button", { name: /Sync CRM/i });
          await btn.waitFor({ state: "visible" });
          await btn.scrollIntoViewIfNeeded();
          await btn.screenshot({ path: shot });
          // NO clickeamos en walkthrough — no queremos disparar la sync de verdad
          return { boundingBox: await boxOf(btn) };
        }
      );

      await step(
        {
          id: "toolbar-export",
          intent: "Export CSV abre el endpoint /api/wolfboard/export en otra pestaña",
          selector: 'a:has-text("Export CSV")',
          helpType: "tooltip",
          helpText: {
            short: "Descarga la planilla como CSV",
            long: "Útil para auditorías o cargar a otra herramienta. El alcance del CSV depende del scope chip activo (Con consulta vs Toda la planilla).",
          },
          optional: true,
        },
        async (shot) => {
          const link = page.getByRole("link", { name: /Export CSV/i });
          await link.waitFor({ state: "visible" });
          await link.scrollIntoViewIfNeeded();
          await link.screenshot({ path: shot });
          return { boundingBox: await boxOf(link) };
        }
      );
    }

    /* ------------------ Command palette ------------------ */
    await step(
      {
        id: "palette-open",
        intent: "⌘K abre la paleta",
        selector: ".adminCot__palette",
        helpType: "callout",
        helpText: {
          short: "Paleta de comandos",
          long: "Buscar acción por nombre y Enter. Flechas ↑↓ para mover, Esc para cerrar. Incluye refresh, batch IA, sync, export, cambio de skin, ir al módulo viejo.",
        },
      },
      async (shot) => {
        await page.keyboard.press("Meta+K");
        const palette = page.locator(".adminCot__palette");
        await palette.waitFor({ state: "visible", timeout: 3000 });
        await palette.screenshot({ path: shot });
        return { boundingBox: await boxOf(palette) };
      }
    );

    await step(
      {
        id: "palette-search",
        intent: "Filtrado fuzzy por texto",
        selector: ".adminCot__palette-input",
        helpType: "tooltip",
        helpText: {
          short: "Filtrá por nombre de acción",
          long: "El input filtra los items por substring. La selección activa se mantiene en el primer match.",
        },
      },
      async (shot) => {
        const input = page.locator(".adminCot__palette-input");
        await input.fill("skin");
        await page.waitForTimeout(150);
        await page.locator(".adminCot__palette").screenshot({ path: shot });
        return { boundingBox: await boxOf(input) };
      }
    );

    /* ------------------ Skin cycle ------------------ */
    const skins = ["macos", "bmc", "gnome", "anthropic", "linear"];
    for (const sk of skins) {
      await step(
        {
          id: `skin-${sk}`,
          intent: `Aplicar skin ${sk} y verificar data-skin en el wrapper raíz`,
          selector: `div.adminCot[data-skin="${sk}"]`,
          helpType: "tooltip",
          helpText: {
            short: `Skin: ${sk}`,
            long: `El skin cambia paleta + tipografía + radios sin tocar el layout. La elección se persiste en localStorage[bmc_admin_cot_skin].`,
          },
        },
        async (shot) => {
          await page.evaluate((s) => {
            try { localStorage.setItem("bmc_admin_cot_skin", s); } catch {}
          }, sk);
          await page.reload({ waitUntil: "domcontentloaded" });
          const root = page.locator(`div.adminCot[data-skin="${sk}"]`).first();
          await root.waitFor({ state: "visible", timeout: 6000 });
          await page.screenshot({ path: shot, fullPage: false });
          return { boundingBox: await boxOf(root) };
        }
      );
    }

    /* ------------------ Reduced motion ------------------ */
    await step(
      {
        id: "reduced-motion",
        intent: "prefers-reduced-motion desactiva el pulse del live-dot y animaciones",
        selector: ".adminCot__live-dot",
        helpType: "tooltip",
        helpText: {
          short: "Respeta tus preferencias del sistema",
          long: "Si activaste Reduce Motion en el OS, las animaciones (pulse, drawer slide, shimmer) se cortan. WCAG 2.3.3.",
        },
      },
      async (shot) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const dot = page.locator(".adminCot__live-dot").first();
        await dot.waitFor({ state: "visible" });
        await dot.screenshot({ path: shot });
        return { boundingBox: await boxOf(dot) };
      }
    );

    /* ------------------ A11y focus ------------------ */
    await step(
      {
        id: "a11y-focus-visible",
        intent: "Tab navega y muestra focus ring 2px en el elemento activo",
        selector: ":focus-visible",
        helpType: "tooltip",
        helpText: {
          short: "Accesible con teclado",
          long: "Tab recorre todos los interactivos en orden lógico. El outline 2px (criterio WCAG 2.4.13) hace visible el foco.",
        },
      },
      async (shot) => {
        // Click body to ensure focus baseline
        await page.locator("body").click({ position: { x: 1, y: 1 } }).catch(() => {});
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await page.screenshot({ path: shot, fullPage: false });
        return { boundingBox: null };
      }
    );

  } finally {
    /* Write JSON regardless of success/failure */
    const flagDoc = "VITE_FEATURE_ADMIN_COT_V2=true (required for /hub/cotizaciones to mount)";
    const out = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE,
      url: URL,
      flag: flagDoc,
      mode: TOKEN ? "live" : "dry",
      stepCount: records.length,
      okCount: records.filter((r) => r.status === "ok").length,
      skippedCount: records.filter((r) => r.status === "skipped").length,
      failCount: records.filter((r) => r.status === "fail").length,
      steps: records,
    };
    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(SOURCE_JSON, JSON.stringify(out, null, 2));
    console.log(`→ wrote ${SOURCE_JSON} (${out.stepCount} steps · ${out.okCount} ok · ${out.skippedCount} skipped · ${out.failCount} fail)`);
    await browser.close();
    if (out.failCount > 0) process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL", err?.message || err);
  process.exit(1);
});
