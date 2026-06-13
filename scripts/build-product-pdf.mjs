/**
 * Construye docs/product/PRODUCT-OVERVIEW.pdf a partir de PRODUCT-OVERVIEW.md.
 *
 * Render: markdown-it → HTML → page.pdf() con el Chromium ya instalado por
 * Playwright (evita pandoc/latex). Las imágenes se embeben vía file:// relativo
 * a docs/product/. Verifica que no haya enlaces de imagen rotos antes de generar.
 *
 * Uso:  node scripts/build-product-pdf.mjs
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import MarkdownIt from "markdown-it";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_DIR = resolve(__dirname, "../docs/product");
const MD_PATH = join(DOC_DIR, "PRODUCT-OVERVIEW.md");
const PDF_PATH = join(DOC_DIR, "PRODUCT-OVERVIEW.pdf");

if (!existsSync(MD_PATH)) {
  console.error(`No existe ${MD_PATH}`);
  process.exit(1);
}

const mdRaw = readFileSync(MD_PATH, "utf8");

// Verificar enlaces de imagen (markdown ![..](ruta)) antes de renderizar.
const imgRe = /!\[[^\]]*\]\(([^)]+)\)/g;
const broken = [];
let m;
while ((m = imgRe.exec(mdRaw))) {
  const ref = m[1].trim();
  if (/^https?:/i.test(ref)) continue;
  const abs = resolve(DOC_DIR, ref);
  if (!existsSync(abs)) broken.push(ref);
}
if (broken.length) {
  console.error(`Imágenes rotas (${broken.length}):\n  ` + broken.join("\n  "));
  process.exit(1);
}

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const body = md.render(mdRaw);

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 100%; }
  h1 { font-size: 22pt; border-bottom: 3px solid #2b59ff; padding-bottom: 6px; }
  h2 { font-size: 16pt; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-size: 13pt; margin-top: 18px; page-break-after: avoid; }
  img { max-width: 100%; height: auto; border: 1px solid #e3e3e3; border-radius: 6px; margin: 8px 0; page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f5ff; }
  code { background: #f3f3f3; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  pre { background: #f7f7f7; padding: 10px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 4px solid #2b59ff; margin-left: 0; padding-left: 12px; color: #444; }
  a { color: #2b59ff; text-decoration: none; }
</style></head><body>${body}</body></html>`;

// Render a un archivo temporal dentro de docs/product para que las rutas
// relativas de <img> (assets/...) resuelvan vía file://.
const TMP_HTML = join(DOC_DIR, "_render.html");
writeFileSync(TMP_HTML, html);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(TMP_HTML).href, { waitUntil: "networkidle" });
  await page.pdf({
    path: PDF_PATH,
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
} finally {
  await browser.close();
  rmSync(TMP_HTML, { force: true });
}
console.log(`PDF generado: ${PDF_PATH}`);
