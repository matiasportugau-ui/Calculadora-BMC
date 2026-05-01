// ═══════════════════════════════════════════════════════════════════════════
// src/utils/googleDrive.js — Client-side Google Drive API v3 wrapper +
// Google Identity Services (GIS) auth, including OIDC userinfo for login.
// ═══════════════════════════════════════════════════════════════════════════
/* global google */

const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const APP_FOLDER_NAME = "Panelin BMC Cotizaciones";
const BMC_MIME = "application/json";
const PDF_MIME = "application/pdf";
const FOLDER_MIME = "application/vnd.google-apps.folder";

// XSS exposure trade-off: storing the access token in localStorage means any
// script with JS access to this origin can read it. Acceptable for the
// current single-popup client-side model; for stricter security move the
// token to an httpOnly cookie issued by the /api/auth/google endpoint.
const STORAGE_KEY = "bmc.gdrive.identity";

let _tokenClient = null;
let _accessToken = null;
let _tokenExpiry = 0;
let _user = null;
let _onAuthChange = null;
let _gsiLoadPromise = null;

// ── localStorage persistence ─────────────────────────────────────────────────

function persistIdentity() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: _accessToken,
        expiresAt: _tokenExpiry,
        user: _user,
      }),
    );
  } catch { /* quota / unavailable */ }
}

function clearIdentity() {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* unavailable */ }
}

// Hydrate token + identity from localStorage at module load so reloads stay
// signed in until expiry without re-prompting.
(function rehydrate() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw);
    if (!cached?.accessToken || !cached?.expiresAt || cached.expiresAt <= Date.now()) {
      clearIdentity();
      return;
    }
    _accessToken = cached.accessToken;
    _tokenExpiry = cached.expiresAt;
    _user = cached.user || null;
  } catch {
    clearIdentity();
  }
})();

/**
 * Load GIS script on demand — removed from index.html <head> to avoid
 * blocking the critical render path on mobile.
 */
export function loadGsiScript() {
  if (isGisLoaded()) return Promise.resolve();
  if (_gsiLoadPromise) return _gsiLoadPromise;
  _gsiLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
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

export function getCachedUser() {
  return _user;
}

export function setAuthChangeCallback(cb) {
  _onAuthChange = cb;
}

function notifyAuth() {
  if (_onAuthChange) _onAuthChange(isAuthenticated());
}

/**
 * Fetch the OIDC userinfo payload for an access token granted with
 * `openid email profile` scopes.
 */
async function getUserInfo(accessToken) {
  const resp = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`userinfo ${resp.status}: ${body}`);
  }
  return resp.json();
}

/**
 * Initialize the Google Identity Services token client. Idempotent — safe to
 * call repeatedly. Returns true on success, false if Client ID or GIS missing.
 */
export function initGoogleAuth() {
  if (_tokenClient) return true;
  const clientId = getClientId();
  if (!clientId) {
    console.warn("[GDrive] No VITE_GOOGLE_CLIENT_ID configured");
    return false;
  }
  if (!isGisLoaded()) {
    console.warn("[GDrive] Google Identity Services not loaded");
    return false;
  }

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    // Default callback used only when no signIn() Promise is awaiting the
    // response (e.g. silent token refresh). signIn() replaces it per call.
    callback: (resp) => {
      if (resp.error) {
        console.error("[GDrive] Auth error:", resp.error);
        _accessToken = null;
        notifyAuth();
        return;
      }
      _accessToken = resp.access_token;
      _tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
      notifyAuth();
    },
  });

  return true;
}

/**
 * Request an access token (triggers Google sign-in popup if needed) and fetch
 * the OIDC user profile in the same call. Self-healing: loads the GIS script
 * and initializes the token client if the caller hasn't already.
 *
 * @returns {Promise<{ accessToken: string, expiresAt: number, user: object|null }>}
 */
export async function signIn() {
  await loadGsiScript();
  if (!_tokenClient && !initGoogleAuth()) {
    throw new Error("Google Auth init failed (missing or invalid VITE_GOOGLE_CLIENT_ID)");
  }

  return new Promise((resolve, reject) => {
    if (isAuthenticated() && _user) {
      resolve({ accessToken: _accessToken, expiresAt: _tokenExpiry, user: _user });
      return;
    }

    _tokenClient.callback = async (resp) => {
      if (resp.error) {
        _accessToken = null;
        _tokenExpiry = 0;
        _user = null;
        clearIdentity();
        notifyAuth();
        reject(new Error(resp.error));
        return;
      }
      _accessToken = resp.access_token;
      _tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
      try {
        _user = await getUserInfo(_accessToken);
      } catch (err) {
        // Drive auth still works without identity — keep the token, log it.
        console.warn("[GDrive] userinfo failed:", err.message);
        _user = null;
      }
      persistIdentity();
      notifyAuth();
      resolve({ accessToken: _accessToken, expiresAt: _tokenExpiry, user: _user });
    };

    _tokenClient.requestAccessToken({ prompt: "" });
  });
}

export function signOut() {
  if (_accessToken) {
    google.accounts.oauth2.revoke(_accessToken, () => {});
  }
  _accessToken = null;
  _tokenExpiry = 0;
  _user = null;
  clearIdentity();
  notifyAuth();
}

async function authFetch(url, opts = {}) {
  if (!isAuthenticated()) await signIn();
  const headers = { Authorization: `Bearer ${_accessToken}`, ...(opts.headers || {}) };
  const resp = await fetch(url, { ...opts, headers });
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

async function uploadFile(folderId, fileName, blob, mimeType, existingFileId = null, extraMetadata = {}) {
  const metadata = { name: fileName, ...extraMetadata };
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

  // Tag every saved file with the owner's email so listings can be filtered
  // per user later. appProperties is private to this OAuth client.
  const ownerEmail = _user?.email || "";
  const extra = ownerEmail ? { appProperties: { ownerEmail } } : {};

  const [pdfFile, jsonFile] = await Promise.all([
    uploadFile(subId, finalPdfName, pdfBlob, PDF_MIME, existingPdf?.id, extra),
    uploadFile(subId, finalJsonName, jsonBlob, BMC_MIME, existingJson?.id, extra),
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
