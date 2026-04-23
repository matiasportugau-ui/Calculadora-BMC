/**
 * server/lib/driveUpload.js
 * Upload an HTML string to a Google Drive folder and return a permanent public URL.
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS must be set (same service account used for Sheets).
 *   - The service account email must have "Editor" access to the target Drive folder.
 *   - DRIVE_QUOTE_FOLDER_ID must be set to the ID of that folder.
 *
 * Scope used: drive.file — only files created by this app are accessible.
 */
import { google } from "googleapis";

const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.file";

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_DRIVE] });
  const client = await auth.getClient();
  return google.drive({ version: "v3", auth: client });
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

  const { Readable } = await import("node:stream");
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
