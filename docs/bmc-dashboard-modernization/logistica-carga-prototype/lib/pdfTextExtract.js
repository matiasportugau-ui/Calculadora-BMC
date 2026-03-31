/**
 * Extrae texto de un PDF en el navegador (capa de texto del PDF).
 * Usa pdfjs-dist desde jsDelivr (requiere red la primera vez).
 * PDFs escaneados sin OCR suelen devolver poco o ningún texto.
 */

export const PDFJS_VERSION = "4.8.69";
export const PDFJS_CDN_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

/** @type {Promise<any>} */
let pdfjsModulePromise = null;

export function loadPdfJsModule() {
  if (!pdfjsModulePromise) {
    const url = `${PDFJS_CDN_BASE}/pdf.mjs`;
    pdfjsModulePromise = import(/* webpackIgnore: true */ url).then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.mjs`;
      return m;
    });
  }
  return pdfjsModulePromise;
}

/**
 * @param {ArrayBuffer} buffer
 * @param {{ maxPages?: number }} [opts]
 * @returns {Promise<{ text: string, numPages: number, pagesRead: number, warnings: string[] }>}
 */
export async function extractTextFromPdfArrayBuffer(buffer, opts = {}) {
  const maxPages = opts.maxPages ?? 40;
  const warnings = [];
  if (!buffer || buffer.byteLength === 0) {
    warnings.push("Archivo vacío.");
    return { text: "", numPages: 0, pagesRead: 0, warnings };
  }

  let pdfjs;
  try {
    pdfjs = await loadPdfJsModule();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`No se pudo cargar PDF.js desde la red (jsDelivr). ¿Hay conexión o firewall? ${msg}`);
    return { text: "", numPages: 0, pagesRead: 0, warnings };
  }

  const data = new Uint8Array(buffer);
  let pdf;
  try {
    const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
    pdf = await loadingTask.promise;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`No se pudo abrir el PDF (¿contraseña o archivo dañado?): ${msg}`);
    return { text: "", numPages: 0, pagesRead: 0, warnings };
  }

  const numPages = pdf.numPages;
  const pagesRead = Math.min(numPages, maxPages);
  if (numPages > maxPages) {
    warnings.push(`Solo se leyeron las primeras ${maxPages} páginas de ${numPages}.`);
  }

  const pageChunks = [];
  for (let p = 1; p <= pagesRead; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let cur = "";
    const lines = [];
    for (const item of tc.items) {
      if (!item || typeof item.str !== "string") continue;
      cur += item.str;
      if (item.hasEOL) {
        lines.push(cur.trim());
        cur = "";
      }
    }
    if (cur.trim()) lines.push(cur.trim());
    pageChunks.push(lines.join("\n"));
  }

  const text = pageChunks.join("\n\n").trim();
  if (text.length < 40) {
    warnings.push(
      "Poco texto en el PDF. Si es un escaneo sin OCR, no hay capa de texto seleccionable: probá copiar desde la fuente original o usar OCR."
    );
  }

  return { text, numPages, pagesRead, warnings };
}
