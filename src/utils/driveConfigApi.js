// ═══════════════════════════════════════════════════════════════════════════
// src/utils/driveConfigApi.js — thin client for /api/drive/config.
// ───────────────────────────────────────────────────────────────────────────
// Persists the per-user Drive destination folder. Authenticated with the BMC
// identity JWT (NOT the Google OAuth token) via Authorization: Bearer.
// ═══════════════════════════════════════════════════════════════════════════

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return ""; // same-origin (Vercel rewrites /api → Cloud Run)
})();

function authHeaders(accessToken, extra = {}) {
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extra,
  };
}

/** Map API errors to operator-friendly Spanish copy. */
export function formatDriveConfigError(err) {
  const msg = String(err?.message || err || "");
  if (msg.includes("drive_config_unavailable")) {
    return "El servidor no puede guardar la carpeta todavía (falta migración de base de datos). Avisale al admin: npm run identity:golive:apply";
  }
  if (msg.startsWith("drive config 503")) {
    return "Configuración de Drive no disponible en el servidor. Reintentá en unos minutos o avisale al admin.";
  }
  return msg || "No se pudo configurar la carpeta.";
}

/**
 * Fetch the authed user's configured Drive folder.
 * @returns {Promise<{ folderId, folderName, valid, configuredAt, lastValidatedAt } | null>}
 */
export async function getDriveConfig(accessToken) {
  const resp = await fetch(`${ApiBase}/api/drive/config`, {
    headers: authHeaders(accessToken),
  });
  if (!resp.ok) throw new Error(`drive config ${resp.status}`);
  const data = await resp.json();
  return data?.config || null;
}

/**
 * Persist the selected folder. The client validates write permission before
 * calling this; the server only stores the reference.
 * @returns {Promise<object>} the saved config
 */
export async function saveDriveConfig(accessToken, { folderId, folderName, valid = true }) {
  const resp = await fetch(`${ApiBase}/api/drive/config`, {
    method: "POST",
    headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ folderId, folderName, valid }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`drive config ${resp.status}: ${body}`);
  }
  const data = await resp.json();
  return data?.config || null;
}
