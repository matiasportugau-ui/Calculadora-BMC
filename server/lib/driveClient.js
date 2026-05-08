/**
 * server/lib/driveClient.js
 *
 * Helpers de Drive para el Quote Drive Lifecycle: cliente compartido +
 * operaciones de IO usadas por driveQuoteTree.js y driveQuoteVersioning.js.
 *
 * NOTE: `driveUpload.js` mantiene su propio `getDriveClient` privado para
 * `uploadQuoteToDrive` (legado). Este módulo es paralelo y exporta el cliente
 * + helpers nuevos sin modificar el legado.
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS (service account).
 * Scope: drive.file
 */
import { google } from "googleapis";
import { Readable } from "node:stream";

const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.file";

let _drivePromise = null;

/** Singleton drive v3 client (service account). Reset on auth error. */
export function getDriveClient() {
  if (!_drivePromise) {
    const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_DRIVE] });
    _drivePromise = auth
      .getClient()
      .then((client) => google.drive({ version: "v3", auth: client }))
      .catch((err) => {
        _drivePromise = null;
        throw err;
      });
  }
  return _drivePromise;
}

export function _resetDriveClientForTests() {
  _drivePromise = null;
}

/**
 * Lee metadata de un archivo (incluye appProperties para hash dedup).
 * @param {string} fileId
 */
export async function getFileWithProps(fileId) {
  if (!fileId) throw new Error("fileId required");
  const drive = await getDriveClient();
  const r = await drive.files.get({
    fileId,
    fields:
      "id,name,mimeType,parents,webViewLink,webContentLink,modifiedTime,appProperties",
    supportsAllDrives: true,
  });
  return r.data;
}

/**
 * Sobreescribe el contenido de un archivo existente (mismo fileId, nueva data).
 * El URL público no cambia — útil para mantener Sheet col AH estable.
 * Opcionalmente actualiza appProperties (e.g. contentHash, version).
 *
 * @param {object} args
 * @param {string} args.fileId
 * @param {Buffer|string} args.content
 * @param {string} args.mimeType
 * @param {Record<string,string>} [args.appProperties]
 */
export async function updateFile({ fileId, content, mimeType, appProperties }) {
  if (!fileId) throw new Error("fileId required");
  if (content == null) throw new Error("content required");
  const drive = await getDriveClient();
  const stream = Readable.from([content]);
  const r = await drive.files.update({
    fileId,
    media: { mimeType: mimeType || "application/octet-stream", body: stream },
    requestBody: appProperties ? { appProperties } : undefined,
    fields: "id,webViewLink,modifiedTime,appProperties",
    supportsAllDrives: true,
  });
  return r.data;
}

/**
 * Crea un nuevo archivo con contenido. Usado para current/* en primer save y
 * para snapshots en archive/.
 *
 * @param {object} args
 * @param {string} args.parentId
 * @param {string} args.name
 * @param {Buffer|string} args.content
 * @param {string} args.mimeType
 * @param {Record<string,string>} [args.appProperties]
 * @param {boolean} [args.publicReader=true] - permission anyone:reader
 */
export async function createFile({
  parentId,
  name,
  content,
  mimeType,
  appProperties,
  publicReader = true,
}) {
  if (!parentId || !name) throw new Error("parentId and name required");
  const drive = await getDriveClient();
  const stream = Readable.from([content]);
  const r = await drive.files.create({
    requestBody: {
      name,
      mimeType: mimeType || "application/octet-stream",
      parents: [parentId],
      ...(appProperties ? { appProperties } : {}),
    },
    media: { mimeType: mimeType || "application/octet-stream", body: stream },
    fields: "id,name,webViewLink,appProperties",
    supportsAllDrives: true,
  });
  if (publicReader && r.data.id) {
    await drive.permissions
      .create({
        fileId: r.data.id,
        requestBody: { role: "reader", type: "anyone" },
      })
      .catch(() => {
        // ignore — permission ya existe o policy bloquea
      });
  }
  return r.data;
}

/**
 * Copia un archivo a otro folder con nuevo nombre. Crea fileId nuevo (URL nueva).
 * Usado para promover current → archive.
 *
 * @param {object} args
 * @param {string} args.fileId
 * @param {string} args.parentId
 * @param {string} args.newName
 */
export async function copyFile({ fileId, parentId, newName }) {
  if (!fileId || !parentId || !newName) {
    throw new Error("fileId, parentId, newName required");
  }
  const drive = await getDriveClient();
  const r = await drive.files.copy({
    fileId,
    requestBody: { name: newName, parents: [parentId] },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });
  return r.data;
}

/**
 * Actualiza solo appProperties (sin tocar contenido). Para borrar una key,
 * pasar value === null.
 *
 * @param {string} fileId
 * @param {Record<string,string|null>} appProperties
 */
export async function setAppProperties(fileId, appProperties) {
  if (!fileId) throw new Error("fileId required");
  const drive = await getDriveClient();
  const r = await drive.files.update({
    fileId,
    requestBody: { appProperties },
    fields: "id,appProperties",
    supportsAllDrives: true,
  });
  return r.data;
}
