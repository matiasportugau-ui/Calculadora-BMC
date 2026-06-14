/**
 * Construye los PDF de docs/product (PRODUCT-OVERVIEW + SYSTEM-REFERENCE) a partir
 * de sus .md.
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

const DOCS = [
  { md: "PRODUCT-OVERVIEW.md", pdf: "PRODUCT-OVERVIEW.pdf" },
  { md: "SYSTEM-REFERENCE.md", pdf: "SYSTEM-REFERENCE.pdf" },
];

const STYLE = `
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 100%; }
  h1 { font-size: 22pt; border-bottom: 3px solid #2b59ff; padding-bottom: 6px; }
  h2 { font-size: 16pt; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-size: 13pt; margin-top: 18px; page-break-after: avoid; }
  img { max-width: 100%; height: auto; border: 1px solid #e3e3e3; border-radius: 6px; margin: 8px 0; page-break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  th, td { border: 1px solid #ccc; padding: 4px 7px; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: #f3f5ff; }
  code { background: #f3f3f3; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }
  pre { background: #f7f7f7; padding: 10px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 4px solid #2b59ff; margin-left: 0; padding-left: 12px; color: #444; }
  a { color: #2b59ff; text-decoration: none; }
`;

/** Falla si un ![alt](ruta) local no existe (evita PDFs con imágenes rotas). */
function checkImages(mdRaw) {
  const imgRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  const broken = [];
  let m;
  while ((m = imgRe.exec(mdRaw))) {
    const ref = m[1].replace(/\s+["'].*["']\s*$/, "").trim(); // quita título opcional
    if (/^https?:/i.test(ref)) continue;
    if (!existsSync(resolve(DOC_DIR, ref))) broken.push(ref);
  }
  return broken;
}

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const { md: mdName, pdf: pdfName } of DOCS) {
    const mdPath = join(DOC_DIR, mdName);
    if (!existsSync(mdPath)) {
      console.warn(`(omitido) no existe ${mdName}`);
      continue;
    }
    const mdRaw = readFileSync(mdPath, "utf8");
    const broken = checkImages(mdRaw);
    if (broken.length) {
      console.error(`Imágenes rotas en ${mdName} (${broken.length}):\n  ` + broken.join("\n  "));
      process.exitCode = 1;
      continue;
    }
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${md.render(mdRaw)}</body></html>`;
    // Archivo temporal dentro de docs/product para que las rutas relativas de
    // <img> (assets/...) resuelvan vía file://.
    const tmp = join(DOC_DIR, `_render-${pdfName}.html`);
    writeFileSync(tmp, html);
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
      await page.pdf({
        path: join(DOC_DIR, pdfName),
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });
      await page.close();
      console.log(`PDF generado: docs/product/${pdfName}`);
    } finally {
      rmSync(tmp, { force: true });
    }
  }
} finally {
  await browser.close();
}
