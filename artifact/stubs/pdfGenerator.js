// Artifact stub for src/utils/pdfGenerator.js
// Skips /api/pdf/generate (unreachable from the sandbox) and goes directly
// to the html2pdf.js client-side path.

let _html2pdfLoader = null;
async function getHtml2Pdf() {
  if (!_html2pdfLoader) {
    _html2pdfLoader = import("html2pdf.js").then((m) => m.default || m);
  }
  return _html2pdfLoader;
}

async function htmlToPdfViaHtml2Pdf(htmlString) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none;background:#fff;z-index:-1;";
  document.body.appendChild(iframe);
  try {
    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(htmlString);
    iDoc.close();
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

export async function htmlToPdfBlob(htmlString) {
  return htmlToPdfViaHtml2Pdf(htmlString);
}

export async function downloadPdf(htmlString, filename = "cotizacion.pdf") {
  const blob = await htmlToPdfBlob(htmlString);
  return downloadPdfBlob(blob, filename);
}

export function downloadPdfBlob(blob, filename = "cotizacion.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}
