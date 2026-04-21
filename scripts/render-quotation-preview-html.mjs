#!/usr/bin/env node
/**
 * Regenera HTML estático en public/quotation-preview/ usando los mismos
 * generadores que la calculadora (quotationViews.js).
 *
 * Uso: npm run quotation-preview:render
 * Luego abrir http://localhost:5173/quotation-preview/ con npm run dev.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sampleClientVisualData, sampleCosteoData } from "../src/utils/quotationPreviewSampleData.js";
import { generateClientVisualHTML, generateCosteoHTML } from "../src/utils/quotationViews.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/quotation-preview");

mkdirSync(outDir, { recursive: true });

const clientHtml = generateClientVisualHTML(sampleClientVisualData);
const costeoHtml = generateCosteoHTML(sampleCosteoData);

writeFileSync(join(outDir, "hoja-visual-cliente.html"), clientHtml, "utf8");
writeFileSync(join(outDir, "costeo-interno.html"), costeoHtml, "utf8");

const indexHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cotización — previews HTML</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #1d1d1f; }
    body { max-width: 720px; margin: 32px auto; padding: 0 16px; line-height: 1.5; }
    h1 { font-size: 1.25rem; color: #003366; }
    ul { padding-left: 1.2rem; }
    a { color: #003366; font-weight: 600; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    .note { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-top: 20px; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>Previews de cotización (HTML)</h1>
  <p>Archivos generados por <code>npm run quotation-preview:render</code>. Misma salida que <code>generateClientVisualHTML</code> y <code>generateCosteoHTML</code>.</p>
  <ul>
    <li><a href="./hoja-visual-cliente.html">Hoja visual cliente (A4)</a></li>
    <li><a href="./costeo-interno.html">Costeo interno (A4 apaisado)</a></li>
  </ul>
  <div class="note">
    <b>Edición visual:</b> podés abrir los enlaces con el servidor Vite (<code>npm run dev</code>) y usar las herramientas de desarrollo del navegador, o guardar una copia del HTML y editarla en tu editor.<br /><br />
    <b>Para que los cambios entren en la app:</b> portá el markup a <code>src/utils/quotationViews.js</code> (o ajustá datos de ejemplo en <code>src/utils/quotationPreviewSampleData.js</code> y volvé a correr el script).
  </div>
</body>
</html>
`;

writeFileSync(join(outDir, "index.html"), indexHtml, "utf8");

console.log("Wrote:");
console.log(`  ${join(outDir, "index.html")}`);
console.log(`  ${join(outDir, "hoja-visual-cliente.html")}`);
console.log(`  ${join(outDir, "costeo-interno.html")}`);
