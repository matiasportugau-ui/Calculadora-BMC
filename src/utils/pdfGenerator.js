// ═══════════════════════════════════════════════════════════════════════════
// src/utils/pdfGenerator.js — Generate real PDF Blob from print HTML
// Uses html2pdf.js (wraps html2canvas + jsPDF)
//
// IMPORTANT: Margins here MUST match the CSS @page rule in helpers.js:
//   @page { size: A4; margin: 14mm 12mm 22mm 12mm; }
//   → html2pdf margin: [top=14, left=12, bottom=22, right=12]
// ═══════════════════════════════════════════════════════════════════════════

import html2pdf from "html2pdf.js";

/** Unified margin config (mm): [top, left, bottom, right] */
const PDF_MARGINS = [14, 12, 22, 12];

/**
 * Convert the print-ready HTML string into a PDF Blob.
 *
 * Uses an off-screen shadow DOM container to isolate print styles
 * and improve reliability for font loading / CSS @page rendering.
 *
 * @param {string} htmlString — full HTML document from generatePrintHTML()
 * @returns {Promise<Blob>} — PDF blob ready for upload or download
 */
export async function htmlToPdfBlob(htmlString) {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:0;top:0;width:210mm;background:#fff;z-index:-1;visibility:hidden;pointer-events:none;";

  const shadow = container.attachShadow({ mode: "open" });

  const wrapper = document.createElement("div");

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const styles = doc.querySelectorAll("style");
  styles.forEach((s) => {
    const clone = document.createElement("style");
    clone.textContent = s.textContent;
    shadow.appendChild(clone);
  });

  wrapper.innerHTML = doc.body.innerHTML;
  shadow.appendChild(wrapper);
  document.body.appendChild(container);

  try {
    const blob = await html2pdf()
      .set({
        margin: PDF_MARGINS,
        filename: "cotizacion.pdf",
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(wrapper)
      .outputPdf("blob");

    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Quick helper: generate PDF and trigger a browser download.
 */
export async function downloadPdf(htmlString, filename = "cotizacion.pdf") {
  const blob = await htmlToPdfBlob(htmlString);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}
