/**
 * server/lib/driveUpload.js
 * Upload quotes to Google Drive (user OAuth → the account's own folder).
 *
 * Prerequisites:
 *   - GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN
 *     (Desktop OAuth client acting as the account that owns the quotes; minted with
 *     `node pipeline.mjs --drive-auth` in bmc-sheet-quote-pipeline).
 *   - DRIVE_QUOTE_FOLDER_ID must be set to a folder created by that same OAuth client.
 *
 * Fallback: without those vars it uses GOOGLE_APPLICATION_CREDENTIALS (service account),
 * which Google rejects for My Drive uploads ("Service Accounts do not have storage
 * quota") — kept only so non-Drive callers keep failing soft exactly as before.
 *
 * Scope used: drive.file — only files created by this app are accessible.
 */
import { google } from "googleapis";
import { Readable } from "node:stream";
import {
  buildDriveClientFolderName,
  buildDriveQuotationFolderName,
  clientFileSlug,
  montevideoYmd,
} from "../../src/utils/quotationNaming.js";

const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const PDF_MIME = "application/pdf";
const BMC_MIME = "application/json";

function userOAuthAvailable() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

let _drivePromise = null;
function getDriveClient() {
  if (!_drivePromise) {
    if (userOAuthAvailable()) {
      // Act as the user: their Drive, their quota. Service accounts can't upload
      // to My Drive folders (no storage quota), so this is the only path that works.
      const oauth = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET
      );
      oauth.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
      _drivePromise = Promise.resolve(google.drive({ version: "v3", auth: oauth }));
    } else {
      const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_DRIVE] });
      _drivePromise = auth.getClient()
        .then((client) => google.drive({ version: "v3", auth: client }))
        .catch((err) => {
          _drivePromise = null;
          throw err;
        });
    }
  }
  return _drivePromise;
}

function escapeDriveQueryLiteral(s) {
  return String(s || "").replace(/'/g, "\\'");
}

async function findFolderByName(drive, name, parentId) {
  const q = [
    `name='${escapeDriveQueryLiteral(name)}'`,
    `mimeType='${FOLDER_MIME}'`,
    "trashed=false",
  ];
  if (parentId) q.push(`'${parentId}' in parents`);

  const { data } = await drive.files.list({
    q: q.join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 5,
  });
  return data.files?.[0] || null;
}

async function findOrCreateFolder(drive, name, parentId) {
  const existing = await findFolderByName(drive, name, parentId);
  if (existing?.id) return existing.id;

  const body = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];

  const { data } = await drive.files.create({
    requestBody: body,
    fields: "id",
  });
  return data.id;
}

async function findFileInFolder(drive, folderId, fileName) {
  const q = [
    `name='${escapeDriveQueryLiteral(fileName)}'`,
    `'${folderId}' in parents`,
    "trashed=false",
  ];
  const { data } = await drive.files.list({
    q: q.join(" and "),
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 2,
  });
  return data.files?.[0] || null;
}

/**
 * Load the first .bmc.json inside a quotation folder (pipeline / calc archive).
 * Uses the same user OAuth as uploads so openDrive works even when the browser
 * GIS client (drive.file, different client id) cannot see pipeline-created files.
 *
 * @param {string} folderId
 * @returns {Promise<{ projectData: object, fileId: string, fileName: string } | null>}
 */
export async function loadProjectFromDriveFolder(folderId) {
  const id = String(folderId || "").trim();
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(id)) {
    throw Object.assign(new Error("invalid_folder_id"), { code: "bad_request" });
  }
  if (!userOAuthAvailable() && !process.env.DRIVE_QUOTE_FOLDER_ID) {
    throw Object.assign(new Error("drive_unavailable"), { code: "drive_unavailable" });
  }

  const drive = await getDriveClient();
  const q = [
    `'${escapeDriveQueryLiteral(id)}' in parents`,
    "trashed=false",
    "(name contains '.bmc.json' or name contains '.json')",
  ].join(" and ");

  const { data: listed } = await drive.files.list({
    q,
    fields: "files(id,name,mimeType)",
    spaces: "drive",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = listed.files || [];
  const preferred =
    files.find((f) => /\.bmc\.json$/i.test(f.name || "")) ||
    files.find((f) => /\.json$/i.test(f.name || "")) ||
    null;
  if (!preferred?.id) return null;

  const { data: media } = await drive.files.get(
    { fileId: preferred.id, alt: "media" },
    { responseType: "text" },
  );
  const text = typeof media === "string" ? media : String(media || "");
  let projectData;
  try {
    projectData = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("invalid_bmc_json"), { code: "bad_request" });
  }
  if (!projectData || typeof projectData !== "object") {
    throw Object.assign(new Error("invalid_bmc_json"), { code: "bad_request" });
  }
  return { projectData, fileId: preferred.id, fileName: preferred.name || "" };
}

/**
 * DRIVE_QUOTE_FOLDER_ID → cliente → código cotización.
 */
export async function ensureQuotationFolderPath(drive, rootFolderId, quotationCode, proyecto = {}) {
  const clientSegment = buildDriveClientFolderName(proyecto);
  const clientFolderId = await findOrCreateFolder(drive, clientSegment, rootFolderId);
  const quoteName = buildDriveQuotationFolderName(quotationCode);
  const quoteFolderId = await findOrCreateFolder(drive, quoteName, clientFolderId);
  return { clientFolderId, quoteFolderId, quoteName };
}

async function uploadBinaryFile(drive, {
  buffer,
  filename,
  mimeType,
  folderId,
  existingFileId = null,
  appProperties = null,
}) {
  const stream = Readable.from([buffer]);
  const requestBody = { name: filename };
  if (appProperties && Object.keys(appProperties).length) {
    requestBody.appProperties = appProperties;
  }

  if (existingFileId) {
    const { data } = await drive.files.update({
      fileId: existingFileId,
      requestBody,
      media: { mimeType, body: stream },
      fields: "id,webViewLink",
    });
    return data;
  }

  const { data } = await drive.files.create({
    requestBody: { ...requestBody, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: "id,webViewLink",
  });
  return data;
}

/**
 * Upload HTML content to Drive and return the public webViewLink.
 * @param {string} html - HTML string to upload
 * @param {string} filename - e.g. "Cotizacion-WB5-2026-04-23.html"
 * @param {string} folderId - Drive folder ID (from DRIVE_QUOTE_FOLDER_ID)
 * @returns {Promise<string|null>} webViewLink or null on failure
 */
export async function uploadQuoteToDrive(html, filename, folderId) {
  if (!folderId || !html) return null;

  const drive = await getDriveClient();
  const stream = Readable.from([html]);

  const createRes = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType: "text/html",
      parents: [folderId],
    },
    media: {
      mimeType: "text/html",
      body: stream,
    },
    fields: "id,webViewLink",
  });

  const fileId = createRes.data.id;
  if (!fileId) return null;

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return createRes.data.webViewLink || null;
}

/**
 * Archive calculator export (PDF + .bmc.json) under the shared company folder.
 *
 * @returns {Promise<{ folderId, folderUrl, pdfFileId, jsonFileId, pdfFileName, jsonFileName }>}
 */
export async function saveQuotationBundleToDrive({
  rootFolderId,
  quotationCode,
  proyecto = {},
  pdfBuffer,
  projectData,
  pdfFileName: pdfNameOverride,
  jsonFileName: jsonNameOverride,
  exportedBy = "",
  source = "calc_export",
}) {
  if (!rootFolderId) throw Object.assign(new Error("drive_folder_unconfigured"), { code: "drive_unavailable" });
  if (!pdfBuffer?.length) throw Object.assign(new Error("missing_pdf"), { code: "bad_request" });

  const drive = await getDriveClient();
  const { quoteFolderId } = await ensureQuotationFolderPath(
    drive,
    rootFolderId,
    quotationCode,
    proyecto,
  );

  const qCode = String(quotationCode || "BMC").trim() || "BMC";
  const slug = clientFileSlug(proyecto);
  const ymd = montevideoYmd();
  const finalPdfName = pdfNameOverride || `${qCode}_${ymd}_${slug}.pdf`;
  const finalJsonName = jsonNameOverride || `${qCode}.bmc.json`;

  const appProperties = {
    exportedBy: String(exportedBy || "").slice(0, 120),
    source: String(source || "calc_export").slice(0, 40),
    quotationCode: qCode.slice(0, 40),
  };

  const [existingPdf, existingJson] = await Promise.all([
    findFileInFolder(drive, quoteFolderId, finalPdfName),
    findFileInFolder(drive, quoteFolderId, finalJsonName),
  ]);

  const jsonBuffer = Buffer.from(JSON.stringify(projectData, null, 2), "utf8");

  const [pdfFile, jsonFile] = await Promise.all([
    uploadBinaryFile(drive, {
      buffer: pdfBuffer,
      filename: finalPdfName,
      mimeType: PDF_MIME,
      folderId: quoteFolderId,
      existingFileId: existingPdf?.id || null,
      appProperties,
    }),
    uploadBinaryFile(drive, {
      buffer: jsonBuffer,
      filename: finalJsonName,
      mimeType: BMC_MIME,
      folderId: quoteFolderId,
      existingFileId: existingJson?.id || null,
      appProperties,
    }),
  ]);

  return {
    folderId: quoteFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${quoteFolderId}`,
    pdfFileId: pdfFile.id,
    jsonFileId: jsonFile.id,
    pdfFileName: finalPdfName,
    jsonFileName: finalJsonName,
    pdfUrl: pdfFile.webViewLink || null,
  };
}

const ALLOWED_PDF_HOSTS = new Set(["storage.googleapis.com"]);

export function isAllowedQuotePdfUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    if (u.protocol !== "https:") return false;
    if (ALLOWED_PDF_HOSTS.has(u.hostname) && u.pathname.startsWith("/bmc-cotizaciones/")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Fetch public GCS quote PDFs and archive them under DRIVE_QUOTE_FOLDER_ID (user OAuth).
 */
export async function archivePdfsFromUrls({
  pdfs = [],
  cliente = "",
  quotationCode = "",
} = {}) {
  const rootFolderId = process.env.DRIVE_QUOTE_FOLDER_ID || "";
  if (!rootFolderId) {
    const err = new Error("DRIVE_QUOTE_FOLDER_ID no configurado");
    err.code = "drive_unavailable";
    throw err;
  }
  if (!userOAuthAvailable()) {
    const err = new Error("Drive OAuth de usuario no configurado (GOOGLE_DRIVE_REFRESH_TOKEN)");
    err.code = "drive_unavailable";
    throw err;
  }

  const list = (Array.isArray(pdfs) ? pdfs : [pdfs])
    .map((item) => {
      if (typeof item === "string") return { url: item.trim() };
      if (item && typeof item === "object") {
        return {
          url: String(item.url || item.pdfUrl || "").trim(),
          fileName: item.fileName || item.name,
        };
      }
      return null;
    })
    .filter((x) => x?.url);

  if (!list.length) {
    const err = new Error("pdfs: pasá al menos una URL");
    err.code = "bad_request";
    throw err;
  }

  const fetched = [];
  for (const item of list) {
    if (!isAllowedQuotePdfUrl(item.url)) {
      const err = new Error(`URL de PDF no permitida: ${item.url.slice(0, 80)}`);
      err.code = "bad_request";
      throw err;
    }
    const res = await fetch(item.url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) {
      const err = new Error(`No pude bajar el PDF (${res.status})`);
      err.code = "fetch_failed";
      throw err;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 12 * 1024 * 1024) {
      const err = new Error("PDF vacío o demasiado grande");
      err.code = "bad_request";
      throw err;
    }
    const fromUrl = decodeURIComponent(item.url.split("/").pop() || "cotizacion.pdf");
    fetched.push({
      buffer: buf,
      fileName: String(item.fileName || fromUrl).replace(/[^\w.\-() ]+/g, "_").slice(0, 180),
    });
  }

  const drive = await getDriveClient();
  const code = String(quotationCode || fetched[0]?.fileName || "BMC").replace(/\.pdf$/i, "").slice(0, 80) || "BMC";
  const { quoteFolderId } = await ensureQuotationFolderPath(
    drive,
    rootFolderId,
    code,
    { nombre: cliente },
  );

  const uploaded = [];
  for (const f of fetched) {
    const existing = await findFileInFolder(drive, quoteFolderId, f.fileName);
    const file = await uploadBinaryFile(drive, {
      buffer: f.buffer,
      filename: f.fileName,
      mimeType: PDF_MIME,
      folderId: quoteFolderId,
      existingFileId: existing?.id || null,
      appProperties: { source: "voice_archive", quotationCode: code.slice(0, 40) },
    });
    uploaded.push({
      fileName: f.fileName,
      fileId: file.id,
      url: file.webViewLink || null,
    });
  }

  return {
    ok: true,
    folderId: quoteFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${quoteFolderId}`,
    files: uploaded,
  };
}
