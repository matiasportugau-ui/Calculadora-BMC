/**
 * Archiva presupuestos exportados en la carpeta compartida BMC (service account vía API).
 * Best-effort: no bloquea la descarga local si Drive falla.
 */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string" || !dataUrl.includes(",")) {
        reject(new Error("invalid_blob_read"));
        return;
      }
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = () => reject(reader.error || new Error("blob_read_failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {Object} params
 * @param {Blob} params.pdfBlob
 * @param {Object} params.projectData — serializeProject output
 * @param {string} params.quotationCode
 * @param {Object} params.proyecto
 * @param {string} [params.pdfFileName]
 * @param {string} [params.exportedBy] — email vendedor / usuario
 * @param {string} [params.source]
 * @returns {Promise<{ ok: boolean, folderUrl?: string, error?: string }>}
 */
export async function archiveQuotationToCompanyDrive({
  pdfBlob,
  projectData,
  quotationCode,
  proyecto,
  pdfFileName,
  exportedBy,
  source = "calc_export",
}) {
  const pdfBase64 = await blobToBase64(pdfBlob);

  const resp = await fetch("/api/quotes/drive-archive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdfBase64,
      projectData,
      quotationCode,
      proyecto,
      pdfFileName,
      exportedBy: exportedBy || null,
      source,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { ok: false, error: data.error || "drive_archive_failed" };
  }
  return { ok: true, ...data };
}
