// ═══════════════════════════════════════════════════════════════════════════
// src/utils/googleDrive.js — Client-side Google Drive API v3 wrapper
// Uses Google Identity Services (GIS) for auth + fetch for Drive REST API
// ═══════════════════════════════════════════════════════════════════════════
/* global google */

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const APP_FOLDER_NAME = "Panelin BMC Cotizaciones";
const BMC_MIME = "application/json";
const PDF_MIME = "application/pdf";
const FOLDER_MIME = "application/vnd.google-apps.folder";

let _tokenClient = null;
let _tokenClientId = null;
let _accessToken = null;
let _tokenExpiry = 0;
let _onAuthChange = null;
let _gsiLoadPromise = null;
let _hasConsented = false;
let _pendingErrorHandler = null;

/**
 * Load GIS script on demand — removed from index.html <head> to avoid
 * blocking the critical render path on mobile.
 *
 * A failed load must NOT poison the cached promise: a transient network error
 * would otherwise permanently disable Drive until the page reloads.
 */
export function loadGsiScript() {
  if (isGisLoaded()) return Promise.resolve();
  if (_gsiLoadPromise) return _gsiLoadPromise;
  _gsiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis-client="1"]');
    const s = existing || document.createElement('script');
    if (!existing) {
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.dataset.gisClient = '1';
    }
    s.addEventListener('load', () => resolve(), { once: true });
    s.addEventListener('error', () => {
      _gsiLoadPromise = null;
      reject(new Error('No se pudo cargar Google Identity Services. Verificá tu conexión o un bloqueador de scripts.'));
    }, { once: true });
    if (!existing) document.head.appendChild(s);
  });
  return _gsiLoadPromise;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function getClientId() {
  return (
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
    window.__BMC_GOOGLE_CLIENT_ID ||
    ""
  );
}

function isGisLoaded() {
  return typeof google !== "undefined" && google.accounts?.oauth2;
}

export function isAuthenticated() {
  return !!_accessToken && Date.now() < _tokenExpiry;
}

export function setAuthChangeCallback(cb) {
  _onAuthChange = cb;
}

function notifyAuth() {
  if (_onAuthChange) _onAuthChange(isAuthenticated());
}

/**
 * Returns true if the Drive integration is configured at runtime
 * (i.e. a Google OAuth Client ID is present).
 */
export function isDriveConfigured() {
  return !!getClientId();
}

/**
 * Initialize the Google Identity Services token client.
 * Must be called after the GIS script loads.
 *
 * Throws a descriptive Error so callers can surface a clear message
 * to the user instead of a silent boolean false.
 */
export function initGoogleAuth() {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      "Google Drive no está configurado: falta VITE_GOOGLE_CLIENT_ID. Pedile al admin que ejecute `npm run drive:configure` (dev) o sincronice la variable en Vercel y redeploy."
    );
  }
  if (!isGisLoaded()) {
    throw new Error("Google Identity Services no está cargado todavía.");
  }

  // Reuse the existing token client if it was created for the same Client ID.
  if (_tokenClient && _tokenClientId === clientId) return true;

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {
      // Default no-op: signIn() rebinds this callback per request so it can
      // resolve/reject the pending promise. Left here so GIS doesn't error
      // if a token response arrives without an explicit caller.
    },
    error_callback: (err) => {
      // GIS routes popup_failed_to_open / popup_closed / etc. here instead
      // of through the success callback. Fan out to the in-flight signIn().
      if (_pendingErrorHandler) {
        const handler = _pendingErrorHandler;
        _pendingErrorHandler = null;
        handler(err);
      } else {
        console.warn("[GDrive] OAuth error (no pending caller):", err);
      }
    },
  });
  _tokenClientId = clientId;

  return true;
}

function describeOAuthError(resp) {
  const code = resp?.error || resp?.type || "oauth_error";
  const subtype = resp?.error_subtype || "";
  const desc = resp?.error_description || resp?.message || "";
  const map = {
    popup_failed_to_open:
      "El navegador bloqueó la ventana de Google. Permití pop-ups para este sitio y volvé a intentar.",
    popup_closed:
      "Cerraste la ventana de Google antes de completar el ingreso.",
    popup_closed_by_user:
      "Cerraste la ventana de Google antes de completar el ingreso.",
    access_denied:
      "Rechazaste el permiso para acceder a Google Drive.",
    invalid_client:
      "El Client ID de Google no es válido o no existe en este proyecto. Verificá VITE_GOOGLE_CLIENT_ID.",
    redirect_uri_mismatch:
      "El origen actual no está autorizado en el cliente OAuth (Authorized JavaScript origins).",
    idpiframe_initialization_failed:
      "Tu navegador o terceros bloquean cookies de Google. Habilitá cookies de terceros para accounts.google.com.",
  };
  const friendly = map[code] || desc || code;
  return new Error(friendly + (subtype ? ` (${subtype})` : ""));
}

/**
 * Request an access token (triggers Google sign-in popup if needed).
 *
 * Self-heals when the token client wasn't initialized (e.g. signIn() called
 * before the panel opened) by lazily loading GIS + initing the client.
 * Uses prompt="consent" the first time so users actually see the consent
 * screen — empty prompt can silently fail in some browser/cookie contexts.
 */
export async function signIn() {
  if (!_tokenClient) {
    await loadGsiScript();
    initGoogleAuth(); // throws with descriptive message if mis-configured
  }

  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      reject(new Error("No se pudo inicializar Google Identity Services."));
      return;
    }

    if (isAuthenticated()) {
      resolve(_accessToken);
      return;
    }

    _tokenClient.callback = (resp) => {
      _pendingErrorHandler = null;
      if (resp?.error) {
        _accessToken = null;
        notifyAuth();
        reject(describeOAuthError(resp));
        return;
      }
      if (!resp?.access_token) {
        reject(new Error("Google no devolvió un access_token."));
        return;
      }
      _accessToken = resp.access_token;
      _tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
      _hasConsented = true;
      notifyAuth();
      resolve(resp.access_token);
    };

    _pendingErrorHandler = (err) => reject(describeOAuthError(err));

    try {
      _tokenClient.requestAccessToken({
        prompt: _hasConsented ? "" : "consent",
      });
    } catch (err) {
      _pendingErrorHandler = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export function signOut() {
  if (_accessToken && typeof google !== "undefined" && google.accounts?.oauth2?.revoke) {
    try { google.accounts.oauth2.revoke(_accessToken, () => {}); } catch { /* ignore */ }
  }
  _accessToken = null;
  _tokenExpiry = 0;
  _hasConsented = false;
  notifyAuth();
}

async function authFetch(url, opts = {}) {
  if (!isAuthenticated()) await signIn();
  const headers = { Authorization: `Bearer ${_accessToken}`, ...(opts.headers || {}) };
  let resp = await fetch(url, { ...opts, headers });
  // Token may have been revoked or expired between the local check and the
  // actual request — retry once after a fresh signIn.
  if (resp.status === 401) {
    _accessToken = null;
    _tokenExpiry = 0;
    notifyAuth();
    await signIn();
    const retryHeaders = { Authorization: `Bearer ${_accessToken}`, ...(opts.headers || {}) };
    resp = await fetch(url, { ...opts, headers: retryHeaders });
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Drive API ${resp.status}: ${body}`);
  }
  return resp;
}

// ── Folder management ────────────────────────────────────────────────────────

async function findOrCreateFolder(name, parentId = null) {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME}'`,
    "trashed=false",
  ];
  if (parentId) q.push(`'${parentId}' in parents`);

  const resp = await authFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q.join(" and "))}&fields=files(id,name)&spaces=drive`,
  );
  const { files } = await resp.json();
  if (files.length > 0) return files[0].id;

  const meta = { name, mimeType: FOLDER_MIME };
  if (parentId) meta.parents = [parentId];

  const create = await authFetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  const folder = await create.json();
  return folder.id;
}

/**
 * Ensure the app root folder and a per-quotation subfolder exist.
 */
async function ensureQuotationFolder(quotationCode, clientName) {
  const rootId = await findOrCreateFolder(APP_FOLDER_NAME);
  const subName = `${quotationCode} — ${(clientName || "proyecto").slice(0, 40)}`;
  const subId = await findOrCreateFolder(subName, rootId);
  return { rootId, subId, subName };
}

// ── File upload ──────────────────────────────────────────────────────────────

async function uploadFile(folderId, fileName, blob, mimeType, existingFileId = null) {
  const metadata = { name: fileName };
  if (!existingFileId) metadata.parents = [folderId];

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append("file", blob);

  const url = existingFileId
    ? `${DRIVE_UPLOAD}/files/${existingFileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD}/files?uploadType=multipart`;

  const method = existingFileId ? "PATCH" : "POST";

  const resp = await authFetch(url, { method, body: form });
  return resp.json();
}

/**
 * Find an existing file by name inside a folder.
 */
async function findFileInFolder(folderId, fileName) {
  const q = [
    `name='${fileName.replace(/'/g, "\\'")}'`,
    `'${folderId}' in parents`,
    "trashed=false",
  ];
  const resp = await authFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q.join(" and "))}&fields=files(id,name)&spaces=drive`,
  );
  const { files } = await resp.json();
  return files.length > 0 ? files[0] : null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a quotation (PDF + .bmc.json) to Google Drive.
 *
 * @param {Object} params
 * @param {string}  params.quotationCode — e.g. "BMC-2026-0042"
 * @param {string}  params.clientName    — client name for folder/file naming
 * @param {Blob}    params.pdfBlob       — the generated PDF
 * @param {Object}  params.projectData   — the serialized project state
 * @param {string}  [params.pdfFileName] — override PDF file name
 * @param {string}  [params.jsonFileName] — override JSON file name
 * @returns {Promise<{ folderId, pdfFileId, jsonFileId, folderUrl }>}
 */
export async function saveQuotation({
  quotationCode,
  clientName,
  pdfBlob,
  projectData,
  pdfFileName: pdfName,
  jsonFileName: jsonName,
}) {
  const { subId } = await ensureQuotationFolder(quotationCode, clientName);

  const safeName = (clientName || "cotización").replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").trim().slice(0, 40);
  const finalPdfName = pdfName || `Cotización ${quotationCode} — ${safeName}.pdf`;
  const finalJsonName = jsonName || `${quotationCode}.bmc.json`;

  const existingPdf = await findFileInFolder(subId, finalPdfName);
  const existingJson = await findFileInFolder(subId, finalJsonName);

  const jsonBlob = new Blob([JSON.stringify(projectData, null, 2)], { type: BMC_MIME });

  const [pdfFile, jsonFile] = await Promise.all([
    uploadFile(subId, finalPdfName, pdfBlob, PDF_MIME, existingPdf?.id),
    uploadFile(subId, finalJsonName, jsonBlob, BMC_MIME, existingJson?.id),
  ]);

  return {
    folderId: subId,
    pdfFileId: pdfFile.id,
    jsonFileId: jsonFile.id,
    folderUrl: `https://drive.google.com/drive/folders/${subId}`,
  };
}

/**
 * List all quotation folders inside the app root folder.
 * Returns folder metadata sorted by most recent.
 */
export async function listQuotations() {
  const rootId = await findOrCreateFolder(APP_FOLDER_NAME);
  const q = [`'${rootId}' in parents`, `mimeType='${FOLDER_MIME}'`, "trashed=false"];
  const resp = await authFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q.join(" and "))}&fields=files(id,name,createdTime,modifiedTime)&orderBy=modifiedTime desc&pageSize=50&spaces=drive`,
  );
  const { files } = await resp.json();
  return files || [];
}

/**
 * Load a .bmc.json project file from a quotation folder.
 *
 * @param {string} folderId — the quotation subfolder ID
 * @returns {Promise<Object|null>} — parsed project data, or null if not found
 */
export async function loadProjectFromFolder(folderId) {
  const q = [
    `'${folderId}' in parents`,
    "name contains '.bmc.json'",
    "trashed=false",
  ];
  const resp = await authFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q.join(" and "))}&fields=files(id,name)&spaces=drive`,
  );
  const { files } = await resp.json();
  if (!files || files.length === 0) return null;

  const download = await authFetch(
    `${DRIVE_API}/files/${files[0].id}?alt=media`,
  );
  return download.json();
}

/**
 * Get the web-viewable URL for a PDF inside a quotation folder.
 */
export async function getPdfUrl(folderId) {
  const q = [
    `'${folderId}' in parents`,
    `mimeType='${PDF_MIME}'`,
    "trashed=false",
  ];
  const resp = await authFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q.join(" and "))}&fields=files(id,name,webViewLink)&spaces=drive`,
  );
  const { files } = await resp.json();
  if (!files || files.length === 0) return null;

  return {
    fileId: files[0].id,
    name: files[0].name,
    viewUrl: files[0].webViewLink || `https://drive.google.com/file/d/${files[0].id}/view`,
  };
}

/**
 * Delete a quotation folder and all its contents.
 */
export async function deleteQuotation(folderId) {
  await authFetch(`${DRIVE_API}/files/${folderId}`, { method: "DELETE" });
}
