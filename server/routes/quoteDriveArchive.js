/**
 * POST /api/quotes/drive-archive
 * Archiva PDF + .bmc.json en la carpeta compartida DRIVE_QUOTE_FOLDER_ID (service account).
 * Llamado automáticamente desde la calculadora tras cada exportación de presupuesto.
 */
import { Router } from "express";
import { saveQuotationBundleToDrive } from "../lib/driveUpload.js";

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_JSON_BYTES = 4 * 1024 * 1024;

export function validateDriveArchiveBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }
  const {
    pdfBase64,
    projectData,
    quotationCode,
    proyecto,
    pdfFileName,
    exportedBy,
    source,
  } = body;

  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return { ok: false, error: "missing_pdf" };
  }
  if (!projectData || typeof projectData !== "object") {
    return { ok: false, error: "missing_project_data" };
  }

  let pdfBuffer;
  try {
    pdfBuffer = Buffer.from(pdfBase64, "base64");
  } catch {
    return { ok: false, error: "invalid_pdf_encoding" };
  }
  if (!pdfBuffer.length) return { ok: false, error: "empty_pdf" };
  if (pdfBuffer.length > MAX_PDF_BYTES) return { ok: false, error: "pdf_too_large" };

  const jsonBytes = Buffer.byteLength(JSON.stringify(projectData), "utf8");
  if (jsonBytes > MAX_JSON_BYTES) return { ok: false, error: "project_data_too_large" };

  const code = String(quotationCode || projectData?._meta?.quotationCode || "").trim();
  if (!code) return { ok: false, error: "missing_quotation_code" };

  return {
    ok: true,
    pdfBuffer,
    projectData,
    quotationCode: code,
    proyecto: proyecto && typeof proyecto === "object" ? proyecto : {},
    pdfFileName: typeof pdfFileName === "string" ? pdfFileName.slice(0, 200) : undefined,
    exportedBy: typeof exportedBy === "string" ? exportedBy.slice(0, 120) : "",
    source: typeof source === "string" ? source.slice(0, 40) : "calc_export",
  };
}

export function createQuoteDriveArchiveRouter(config) {
  const router = Router();

  router.post("/quotes/drive-archive", async (req, res) => {
    if (!config.driveQuoteFolderId) {
      return res.status(503).json({ ok: false, error: "drive_unavailable" });
    }

    const parsed = validateDriveArchiveBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, error: parsed.error });
    }

    try {
      const result = await saveQuotationBundleToDrive({
        rootFolderId: config.driveQuoteFolderId,
        quotationCode: parsed.quotationCode,
        proyecto: parsed.proyecto,
        pdfBuffer: parsed.pdfBuffer,
        projectData: parsed.projectData,
        pdfFileName: parsed.pdfFileName,
        exportedBy: parsed.exportedBy || req.user?.email || "",
        source: parsed.source,
      });

      return res.json({ ok: true, ...result });
    } catch (err) {
      const code = err?.code || err?.message;
      console.error("[quoteDriveArchive]", err?.message || err);
      if (code === "drive_unavailable" || /ENOENT|credentials|invalid_grant|403|404/i.test(String(err?.message))) {
        return res.status(503).json({ ok: false, error: "drive_unavailable" });
      }
      return res.status(500).json({ ok: false, error: "drive_upload_failed" });
    }
  });

  return router;
}
