#!/usr/bin/env node
/**
 * Live-reload dev server para quotation previews.
 *
 * Uso: npm run preview:watch
 * Luego abrir: http://localhost:5173/quotation-preview/hoja-visual-cliente.html
 *
 * Al guardar cualquier archivo fuente, el browser recarga automáticamente.
 */
import { watch, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, "..");
const OUT_DIR  = join(ROOT, "public/quotation-preview");

mkdirSync(OUT_DIR, { recursive: true });

// Polling script inyectado en cada HTML generado
const RELOAD_SCRIPT = `<script>
(function(){var t=0;setInterval(function(){
  fetch('/quotation-preview/__ts.json?_='+Date.now())
    .then(function(r){return r.json()})
    .then(function(d){if(t&&d.t>t){location.reload()}t=d.t})
    .catch(function(){});
},800)})();
</script>`;

function render() {
  const t0 = Date.now();
  const stamp = new Date().toTimeString().slice(0, 8);
  process.stdout.write(`[${stamp}] Rendering... `);

  const result = spawnSync(
    process.execPath,
    ["scripts/render-quotation-preview-html.mjs"],
    { cwd: ROOT, encoding: "utf8" }
  );

  if (result.status !== 0) {
    console.error(`\nERROR:\n${result.stderr || result.stdout}`);
    return;
  }

  // Inyectar reload script en los HTML generados
  for (const file of ["hoja-visual-cliente.html", "costeo-interno.html"]) {
    const path = join(OUT_DIR, file);
    try {
      const html = readFileSync(path, "utf8");
      if (!html.includes("__ts.json")) {
        writeFileSync(path, html.replace("</body>", RELOAD_SCRIPT + "</body>"), "utf8");
      }
    } catch { /* archivo puede no existir aún */ }
  }

  // Actualizar timestamp para disparar recarga en el browser
  writeFileSync(join(OUT_DIR, "__ts.json"), JSON.stringify({ t: Date.now() }), "utf8");

  console.log(`OK (${Date.now() - t0}ms)`);
}

// ── Render inicial ────────────────────────────────────────────────────────────
render();

// ── Archivos a observar ───────────────────────────────────────────────────────
const WATCHED = [
  "src/utils/quotationViews.js",
  "src/utils/quotationPreviewSampleData.js",
  "src/utils/helpers.js",
  "src/utils/calculations.js",
];

let debounce = null;
for (const rel of WATCHED) {
  watch(join(ROOT, rel), () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 350);
  });
}

console.log("┌─────────────────────────────────────────────────────────────┐");
console.log("│  BMC Preview · live reload activo                           │");
console.log("│                                                             │");
console.log("│  Hoja visual: http://localhost:5173/quotation-preview/      │");
console.log("│               hoja-visual-cliente.html                     │");
console.log("│                                                             │");
console.log("│  Archivos observados:                                       │");
for (const f of WATCHED) console.log(`│    · ${f.padEnd(53)}│`);
console.log("│                                                             │");
console.log("│  Ctrl+C para salir                                          │");
console.log("└─────────────────────────────────────────────────────────────┘");
