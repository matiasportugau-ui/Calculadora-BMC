#!/usr/bin/env node
/**
 * NotebookLM master PDF builder.
 *
 * Reads all PNGs in docs/notebooklm-assets/, builds a single HTML deck
 * with one slide per image (title + caption + full-bleed image), and
 * uses Playwright's page.pdf() to render
 * docs/notebooklm-assets/capturas-calculadora-bmc.pdf — the file you
 * upload to NotebookLM as the visual source.
 *
 * Also writes MANIFEST.md with the slide order and one-line caption per image.
 */
import { chromium } from "playwright";
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";

const DIR = resolve(process.cwd(), "docs/notebooklm-assets");
const PDF_PATH = `${DIR}/capturas-calculadora-bmc.pdf`;
const MANIFEST_PATH = `${DIR}/MANIFEST.md`;

const CAPTIONS = {
  "01-home-wizard-paso1.png":
    "Pantalla inicial — Wizard Paso 1 con los 5 escenarios (Solo Techo, Solo Fachada, Techo + Fachada, Cámara Frigorífica, Presupuesto libre) y header completo (Hub, Logística, Vendedor/Cliente, Config, Plano, Drive, Presupuestos, Guardar, Limpiar, Imprimir).",
  "02-selector-escenario.png":
    "Selector de escenario activo (Solo Techo seleccionado) con visor visual del panel ISODEC PIR a la derecha.",
  "03-familia-espesor-panel.png":
    "Wizard Paso 2 — Familia panel techo: ISODEC EPS, ISODEC PIR, ISOROOF 3G, ISOROOF FOIL 3G, ISOROOF Colonial, ISOROOF PLUS 3G.",
  "04-dimensiones-techo.png":
    "Catálogo extendido de paneles con cards visuales (techos y cubiertas, livianos, premium).",
  "05-plano-2d-cotas.png":
    "Catálogo y selector con KPIs de área y paneles en cabecera derecha.",
  "06-bom-grupos.png":
    "Familia panel techo con bottom-sheet de Más acciones / Diseño PDF (BMC PDF — Blueprint Técnico).",
  "07-pricing-totales.png":
    "Vista detallada con totales y selector de lista de precios (Precio BMC vs Precio Web).",
  "08-acciones-export.png":
    "Acciones de export desplegadas: PDF, WhatsApp, Drive, Guardar.",
  "09-hub-modulos.png":
    "Hub operativo (/hub) — landing de módulos.",
  "10-hub-wa.png":
    "Hub WhatsApp (/hub/wa) — cockpit de canal.",
  "11-hub-canales.png":
    "Hub canales (/hub/canales) — vista consolidada.",
  "12-hub-admin.png":
    "Hub admin (/hub/admin) — panel administrativo.",
  "13-panelin-chat.png":
    "Calculadora con la barra del chat Panelín visible en el header.",
  "14-matrix-presentation.png":
    "Presentación Matrix (/matrix-presentation.html) — datos vivos: paquete calculadora-bmc 3.1.5, Git 0bd4d7f, CALCULATOR_DATA_VERSION 45e744c8db, tests validation 384 / roof 10, stack React 18 · Vite 7 · Express 5.",
  "deep-02-familia-panel.png":
    "Wizard Paso 2 (después de elegir Solo Techo) — selector de familia de panel con cards.",
  "deep-03-espesor.png":
    "Wizard Paso 3 — selector de espesor (mm) según familia elegida.",
  "deep-04-color.png":
    "Wizard Paso 4 — selector de color del panel.",
  "deep-05-dimensiones.png":
    "Wizard Paso 5 — Dimensiones cargadas (largo 6.5 m × ancho 5.6 m). Área calculada en KPI superior.",
  "deep-06-plano-2d-cotas.png":
    "Vista previa del techo (2D) — Plano con cadena de cotas, perímetro 26.44 m, 43.7 m² total. Panel derecho con encuentros y zonas.",
  "deep-06b-plano-2d-zoom.png":
    "Crop del SVG del plano 2D — cadena de paneles con cotas en metros y altura 6.5 m.",
  "deep-07-bordes-asignados.png":
    "Plano 2D con bordes asignados (perfiles perimetrales tipo gotero/cumbrera/babeta).",
  "deep-08-bom-completo.png":
    "BOM por grupos — Selladores con Silicona Bromplast, Silicona neutra, Cinta Butilo. Subtotal selladores U$S 133.95 s/IVA.",
  "deep-09-totales-usd.png":
    "Totales y precios USD por línea (cantidad, P. unit, Total) con plano 2D y panel de área (43.7 m²).",
  "deep-10-preview-pdf.png":
    "Vista previa de cotización (PDF) abierta en overlay. Diseño activo: BMC PDF — Blueprint Técnico. Cabecera Imprimir / PDF / Cerrar.",
  "deep-11-panelin-chat-abierto.png":
    "Chat Panelín abierto (drawer derecho) con saludo del agente y quick actions (¿qué puede hacer?, ¿qué te recomiendo?).",
};

function captionFor(name) {
  return CAPTIONS[name] || basename(name, ".png").replace(/[-_]/g, " ");
}

function titleFor(name) {
  return basename(name, ".png").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const all = readdirSync(DIR)
    .filter((f) => f.endsWith(".png") && !f.startsWith(".") && !f.startsWith("capturas-"))
    .sort((a, b) => {
      const aDeep = a.startsWith("deep-");
      const bDeep = b.startsWith("deep-");
      if (aDeep !== bDeep) return aDeep ? 1 : -1; // surface deck first, deep deck second
      return a.localeCompare(b, "es", { numeric: true });
    });

  console.log(`[pdf] ${all.length} screenshots → ${PDF_PATH}`);

  const slides = all
    .map((name, i) => {
      const buf = readFileSync(`${DIR}/${name}`);
      const b64 = buf.toString("base64");
      return `
<section class="slide">
  <header>
    <span class="num">${String(i + 1).padStart(2, "0")} / ${all.length}</span>
    <h1>${titleFor(name)}</h1>
  </header>
  <figure>
    <img src="data:image/png;base64,${b64}" alt="${name}" />
  </figure>
  <footer>
    <p>${captionFor(name)}</p>
    <small>${name}</small>
  </footer>
</section>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Capturas Calculadora BMC — NotebookLM Assets</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif; color: #1D1D1F; }
  .slide {
    width: 297mm; height: 210mm; padding: 10mm 12mm;
    display: grid; grid-template-rows: auto 1fr auto; gap: 4mm;
    page-break-after: always; background: #FFFFFF;
  }
  .slide:last-child { page-break-after: auto; }
  header { display: flex; align-items: baseline; gap: 8mm; border-bottom: 0.4mm solid #E5E5EA; padding-bottom: 3mm; }
  .num { font-size: 9pt; color: #6E6E73; letter-spacing: 0.05em; }
  h1 { margin: 0; font-size: 16pt; color: #1A3A5C; font-weight: 600; letter-spacing: -0.01em; }
  figure { margin: 0; display: flex; align-items: center; justify-content: center; background: #F5F5F7; border-radius: 2mm; overflow: hidden; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
  footer { font-size: 9.5pt; color: #1D1D1F; line-height: 1.35; }
  footer p { margin: 0 0 1mm 0; }
  footer small { color: #AEAEB2; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 7.5pt; }
  .cover { display: grid; grid-template-rows: 1fr auto; height: 210mm; padding: 30mm; background: linear-gradient(135deg, #0A2540 0%, #1A3A5C 100%); color: #FFFFFF; }
  .cover h1 { color: #FFFFFF; font-size: 48pt; line-height: 1.05; margin: 0 0 8mm; }
  .cover p { font-size: 14pt; color: rgba(255,255,255,0.85); margin: 0 0 4mm; max-width: 200mm; }
  .cover .meta { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 10pt; color: rgba(255,255,255,0.7); }
</style>
</head><body>
<section class="slide cover">
  <div>
    <h1>Calculadora BMC v3.1.5</h1>
    <p>Capturas de UI, plano 2D, BOM, exports y módulos operativos. Source para video instructivo NotebookLM.</p>
  </div>
  <div class="meta">
    <p>BMC Uruguay · METALOG SAS &nbsp;·&nbsp; React 18 · Vite 7 · Express 5 · Node 24</p>
    <p>Producción: calculadora-bmc.vercel.app &nbsp;·&nbsp; ${all.length} slides &nbsp;·&nbsp; generado por scripts/notebooklm-build-pdf.mjs</p>
  </div>
</section>
${slides}
</body></html>`;

  writeFileSync(`${DIR}/_deck.html`, html);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--ignore-certificate-errors"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load", timeout: 60000 });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: PDF_PATH,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();

  // ── Manifest ──────────────────────────────────────────────────
  const manifest = `# Capturas Calculadora BMC — Manifest para NotebookLM

Generado: ${new Date().toISOString()}
PDF maestro: \`capturas-calculadora-bmc.pdf\`
Producción: https://calculadora-bmc.vercel.app

| # | Archivo | Caption sugerido |
|---|---------|------------------|
${all
  .map((n, i) => `| ${String(i + 1).padStart(2, "0")} | \`${n}\` | ${captionFor(n).replace(/\|/g, "\\|")} |`)
  .join("\n")}

## Cómo subirlo a NotebookLM

1. Crear notebook "Calculadora BMC — Video Instructivo".
2. Add source → Upload → \`capturas-calculadora-bmc.pdf\`.
3. Add source → Paste text → pegar el bloque del input one-shot (docs/NOTEBOOKLM-VIDEO-ONESHOT si existe, o el bloque del chat).
4. Studio → Video Overview → Customize → pegar la misma directiva.
5. Generate.

## Re-generar capturas

\`\`\`bash
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/notebooklm-capture.mjs
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/notebooklm-capture-deep.mjs
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/notebooklm-build-pdf.mjs
\`\`\`
`;
  writeFileSync(MANIFEST_PATH, manifest);

  console.log(`[pdf] ✓ ${PDF_PATH}`);
  console.log(`[pdf] ✓ ${MANIFEST_PATH}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
