// ═══════════════════════════════════════════════════════════════════════════
// src/utils/pdfGenerator.js — Generate real PDF Blob from print HTML
//
// Strategy (in order):
//   1. POST /api/pdf/generate  — Playwright/Chromium server-side (vectorial)
//   2. html2pdf.js fallback    — html2canvas + jsPDF (raster, legacy)
//
// The server route renders HTML identically to window.print(), preserving
// @page rules, SVG vectors, CSS grid/flex, and system fonts.
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Server-side (preferred) ───────────────────────────────────────────────

async function htmlToPdfViaServer(htmlString, filename) {
  const res = await fetch("/api/pdf/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: htmlString, filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `server_pdf_failed:${res.status}`);
  }
  return res.blob();
}

// ── 2. Client-side fallback (html2pdf.js) ────────────────────────────────────

let _html2pdfLoader = null;
async function getHtml2Pdf() {
  if (!_html2pdfLoader) {
    _html2pdfLoader = import("html2pdf.js").then((m) => m.default || m);
  }
  return _html2pdfLoader;
}

async function htmlToPdfViaHtml2Pdf(htmlString) {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:210mm;background:#fff;z-index:-1;";
  const shadow = container.attachShadow({ mode: "open" });
  const wrapper = document.createElement("div");
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  doc.querySelectorAll("style").forEach((s) => {
    const clone = document.createElement("style");
    clone.textContent = s.textContent;
    shadow.appendChild(clone);
  });
  wrapper.innerHTML = doc.body.innerHTML;
  shadow.appendChild(wrapper);
  document.body.appendChild(container);
  try {
    const html2pdf = await getHtml2Pdf();
    return await html2pdf()
      .set({
        margin: [8, 8, 12, 8],
        filename: "cotizacion.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(wrapper)
      .outputPdf("blob");
  } finally {
    document.body.removeChild(container);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a print-ready HTML string into a PDF Blob.
 * Tries the Playwright server endpoint first; falls back to html2pdf.js.
 *
 * @param {string} htmlString
 * @param {string} [filename]
 * @returns {Promise<Blob>}
 */
export async function htmlToPdfBlob(htmlString, filename = "cotizacion.pdf") {
  try {
    return await htmlToPdfViaServer(htmlString, filename);
  } catch (serverErr) {
    console.warn("[pdfGenerator] server PDF failed, using html2pdf fallback:", serverErr.message);
    return htmlToPdfViaHtml2Pdf(htmlString);
  }
}

/**
 * Quick helper: generate PDF and trigger a browser download.
 */
export async function downloadPdf(htmlString, filename = "cotizacion.pdf") {
  const blob = await htmlToPdfBlob(htmlString);
  return downloadPdfBlob(blob, filename);
}

/**
 * Trigger a browser download from an existing PDF Blob (e.g. after htmlToPdfBlob).
 */
export function downloadPdfBlob(blob, filename = "cotizacion.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}
