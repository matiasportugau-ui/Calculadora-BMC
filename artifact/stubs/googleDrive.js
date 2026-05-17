// Artifact stub for src/utils/googleDrive.js
// Replaces the real Google Drive integration with a localStorage-backed
// implementation. Same exported surface as the real module so consumers
// (GoogleDrivePanel, the calculator itself) compile and run unchanged.

const STORAGE_KEY = "bmc.artifact.gdrive.entries.v1";
const IDENTITY_KEY = "bmc.artifact.gdrive.identity.v1";

const _user = {
  email: "design@bmc.local",
  name: "Diseño BMC",
  picture: "",
  sub: "artifact-design",
};
let _authChangeCb = null;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStore(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

function newId() {
  try {
    return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  } catch {
    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function notify() {
  try { _authChangeCb?.(_user); } catch { /* ignore */ }
}

export function loadGsiScript() {
  return Promise.resolve();
}

export function isAuthenticated() {
  return true;
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return _user;
}

export function setAuthChangeCallback(cb) {
  _authChangeCb = typeof cb === "function" ? cb : null;
}

export function isDriveConfigured() {
  return true;
}

export async function initGoogleAuth() {
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(_user)); } catch { /* ignore */ }
  notify();
  return _user;
}

export async function signIn() {
  return initGoogleAuth();
}

export function signOut() {
  notify();
}

async function blobToBase64(blob) {
  if (!blob) return null;
  if (typeof blob === "string") return blob;
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i += 1) bin += String.fromCharCode(bytes[i]);
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

export async function saveQuotation({
  quotationCode,
  clientName,
  proyecto,
  pdfBlob,
  projectData,
  pdfFileName,
  jsonFileName,
}) {
  const store = readStore();
  const folderId = newId();
  const ymd = new Date().toISOString().slice(0, 10);
  const slug = (clientName || (proyecto && proyecto.nombre) || "cliente")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const qCode = quotationCode || "BMC";
  const finalPdfName = pdfFileName || `${qCode}_${ymd}_${slug}.pdf`;
  const finalJsonName = jsonFileName || `${qCode}.bmc.json`;

  store[folderId] = {
    id: folderId,
    name: `${qCode} / ${slug}`,
    modifiedTime: new Date().toISOString(),
    quotationCode: qCode,
    clientName: clientName || (proyecto && proyecto.nombre) || "",
    proyecto: proyecto || null,
    pdf: {
      name: finalPdfName,
      dataUrl: await blobToBase64(pdfBlob),
    },
    json: {
      name: finalJsonName,
      data: projectData ?? null,
    },
  };

  writeStore(store);

  return {
    folderId,
    pdfFileId: `${folderId}:pdf`,
    jsonFileId: `${folderId}:json`,
    folderUrl: `localstorage://artifact/quotations/${folderId}`,
  };
}

export async function listQuotations() {
  const store = readStore();
  return Object.values(store)
    .sort((a, b) => String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || "")))
    .slice(0, 50)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      modifiedTime: entry.modifiedTime,
    }));
}

export async function loadProjectFromFolder(folderId) {
  const store = readStore();
  return store[folderId]?.json?.data ?? null;
}

export async function getPdfUrl(folderId) {
  const store = readStore();
  const entry = store[folderId];
  if (!entry || !entry.pdf?.dataUrl) return null;
  return {
    fileId: `${folderId}:pdf`,
    name: entry.pdf.name,
    viewUrl: entry.pdf.dataUrl,
  };
}

export async function deleteQuotation(folderId) {
  const store = readStore();
  if (store[folderId]) {
    delete store[folderId];
    writeStore(store);
  }
}
