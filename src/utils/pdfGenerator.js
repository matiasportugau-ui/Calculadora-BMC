// ═══════════════════════════════════════════════════════════════════════════
// src/utils/pdfGenerator.js — Generate real PDF Blob from print HTML
// Uses html2pdf.js (wraps html2canvas + jsPDF)
// ═══════════════════════════════════════════════════════════════════════════

import html2pdf from "html2pdf.js";

/**
 * Convert the print-ready HTML string into a PDF Blob.
 *
 * Creates a temporary off-screen container, renders the HTML,
 * uses html2pdf to capture it as a multi-page A4 PDF, and returns
 * the resulting Blob.
 *
 * @param {string} htmlString — full HTML document from generatePrintHTML()
 * @returns {Promise<Blob>} — PDF blob ready for upload or download
 */
export async function htmlToPdfBlob(htmlString) {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:210mm;background:#fff;z-index:-1;";

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
        margin: [8, 8, 12, 8],
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
