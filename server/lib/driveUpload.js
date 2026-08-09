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
