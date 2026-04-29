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
  // Use iframe instead of Shadow DOM — html2canvas cannot render Shadow DOM.
  // The iframe gives full CSS isolation (including :root custom properties)
  // while remaining accessible to html2canvas.
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none;background:#fff;z-index:-1;";
  document.body.appendChild(iframe);
  try {
    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(htmlString);
    iDoc.close();
    // Allow fonts + layout to settle
    await new Promise((r) => setTimeout(r, 400));
    const html2pdf = await getHtml2Pdf();
    return await html2pdf()
      .set({
        margin: 0,
        filename: "cotizacion.pdf",
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          windowWidth: 794,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], before: ".page" },
      })
      .from(iDoc.body)
      .outputPdf("blob");
  } finally {
    document.body.removeChild(iframe);
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
