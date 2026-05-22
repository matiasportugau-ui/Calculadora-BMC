/**
 * enviadosFetcher.js — Capa de abstracción para leer filas de Enviados.
 *
 * Modos (auto-seleccionados):
 *   - "api"    : si BMC_EVALS_API_BASE está set → HTTP GET al proxy de Cloud Run
 *   - "direct" : si hay credenciales locales → Google Sheets API directo
 *
 * El proxy `GET /api/admin-cot/enviados/...` (server/routes/adminCotRead.js)
 * autentica con `Authorization: Bearer ${EVALS_API_TOKEN}` y devuelve filas
 * en el mismo formato que la lectura directa.
 *
 * Esto destraba el caso "harness corriendo en contenedor efímero sin SA
 * montada" — el SA está en Cloud Run, no acá.
 */

const API_BASE = process.env.BMC_EVALS_API_BASE;
const API_TOKEN = process.env.BMC_EVALS_API_TOKEN || process.env.EVALS_API_TOKEN;

function shouldUseApi() {
  return Boolean(API_BASE);
}

async function apiFetch(pathAndQuery) {
  const url = `${API_BASE.replace(/\/$/, "")}${pathAndQuery}`;
  const headers = { Accept: "application/json" };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`API ${res.status} ${res.statusText} en ${url}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export async function discoverFromAny() {
  if (shouldUseApi()) {
    const j = await apiFetch(`/api/admin-cot/enviados/discover`);
    return {
      mode: "api",
      sheetId: j.sheetId,
      headers: j.headers || [],
      sampleRows: j.sampleRows || [],
    };
  }
  const { discoverHeaders } = await import("./readEnviados.js");
  const { getSheetId } = await import("./sheetsClient.js");
  const { headers, sampleRows } = await discoverHeaders();
  return { mode: "direct", sheetId: getSheetId(), headers, sampleRows };
}

export async function fetchRows({ mode, from, to, fromDate, toDate }) {
  if (shouldUseApi()) {
    let query;
    if (mode === "range") {
      query = `?from=${from}&to=${to}`;
    } else if (mode === "date-range") {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      query = `?${params.toString()}`;
    } else {
      throw new Error(`Modo de fetch desconocido: ${mode}`);
    }
    const j = await apiFetch(`/api/admin-cot/enviados${query}`);
    return { rows: j.rows || [], sheetId: j.sheetId, mode: "api" };
  }
  const { readRowsRange, readRowsByDate } = await import("./readEnviados.js");
  const { getSheetId } = await import("./sheetsClient.js");
  let rows;
  if (mode === "range") {
    rows = await readRowsRange(from, to);
  } else {
    rows = await readRowsByDate(fromDate, toDate);
  }
  return { rows, sheetId: getSheetId(), mode: "direct" };
}
