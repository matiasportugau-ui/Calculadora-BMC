/**
 * hitlAdminBoard.js — pure helpers for the HITL (cola) live board.
 *
 * Projects the Admin. sheet (SoT: WOLFB_ADMIN_SHEET_ID) into a stable
 * "actionable pendings" shape that the HITL dashboard (bmc-cola-hitl on
 * Vercel) can consume as a drop-in replacement for the limited board.json
 * ML-only feed.
 *
 * Pure functions only: NO googleapis / NO network / NO config imports.
 * This file is unit-tested standalone; route wiring lives in
 * server/routes/hitlBoard.js.
 *
 * Admin. column layout — LIVE header (SoT: server/lib/adminSheetSchema.js):
 *   A=ID            B=Asig.         C=Estado           D=Fecha
 *   E=Cliente       F=Origen        G=Teléfono         H=Dirección/Zona
 *   I=Consulta      J=Interpretación AI
 *   K=Respuesta AI  L=Datos Faltantes
 *   M=PRESUPUESTO   N=Enviado
 *
 * Pre-realignment (2026-10-06) this module read estado from L, respuesta
 * from J, link from K and replay from M — ALL stolen from the live header
 * (that layout was Interpretación AI / Datos Faltantes / Respuesta AI /
 * PRESUPUESTO). Reading from the wrong columns made the board show
 * "Pendiente" for every human row (because L actually holds Datos Faltantes
 * notes) and the write-back path overwrote the AI columns on triage.
 */

import crypto from "node:crypto";
import { ADMIN_COL_INDEX, readAdminCell } from "./adminSheetSchema.js";

/**
 * Estado values recognised as "actionable" for the HITL cola.
 * Everything else (blank, "Enviado", unknown) is treated as not-actionable
 * and filtered out of the live board by default. Matching is case- and
 * whitespace-insensitive to tolerate operator-typed strings
 * ("Pendiente " with trailing space is observed in the live sheet).
 */
export const ACTIONABLE_ESTADOS = Object.freeze([
  "cotizable",
  "pendiente",
  "falta info",
  "asignado",
  "reclamo",
]);

const ACTIONABLE_SET = new Set(ACTIONABLE_ESTADOS);

/** Normalize an Estado cell for comparison. */
export function normalizeEstado(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True if the normalized Estado is in the actionable allowlist. */
export function isActionableEstado(raw) {
  const n = normalizeEstado(raw);
  if (!n) return false;
  if (ACTIONABLE_SET.has(n)) return true;
  // Tolerate common variants: "falta_info", "falta-info".
  const nn = n.replace(/[_-]+/g, " ");
  return ACTIONABLE_SET.has(nn);
}

/**
 * Extract a Mercado Libre QID (question id) and MLU listing id from the
 * Admin.I consulta cell, which by convention embeds a trailer like
 *   "— Q:13667120509 · MLU757318280 · https://…"
 * Returns {} if not present.
 */
export function parseConsultaMarkers(consulta) {
  const s = String(consulta ?? "");
  const out = {};
  const q = s.match(/Q\s*:\s*(\d{6,})/i);
  if (q) out.ml_qid = q[1];
  const mlu = s.match(/MLU\s*[-:]?\s*(\d{6,})/i);
  if (mlu) out.ml_mlu = mlu[1];
  const url = s.match(/https?:\/\/[^\s)]+/i);
  if (url) out.listing_url = url[0];
  return out;
}

/**
 * Derive a human-friendly short title from the consulta body.
 * Strips the "— Q:… · MLU… · https://…" ML trailer and truncates.
 */
export function deriveTitle(consulta, maxLen = 140) {
  const raw = String(consulta ?? "").trim();
  if (!raw) return "";
  const [first] = raw.split(/\n[—–−-]\s|\s[—–−-]\sQ\s*:/);
  const line = String(first || raw).split(/\n/)[0].trim();
  return line.length > maxLen ? line.slice(0, maxLen - 1) + "…" : line;
}

/** Stable priority ordering so UI can render newest-actionable first. */
const ESTADO_PRIORITY = {
  reclamo: 0,
  cotizable: 1,
  asignado: 2,
  "falta info": 3,
  pendiente: 4,
};

export function estadoPriority(raw) {
  const n = normalizeEstado(raw).replace(/[_-]+/g, " ");
  return Number.isFinite(ESTADO_PRIORITY[n]) ? ESTADO_PRIORITY[n] : 99;
}

/**
 * Map a raw Admin.A:M row into a HITL board card.
 * `rowIndex` is 0-based within the A2:M range; the resulting `adminRow` is
 * the 1-based absolute sheet row (used by POST /api/hitl/row/update and by
 * the existing /api/wolfboard/row endpoint for write-back).
 */
export function mapAdminRowToHitlCard(row, rowIndex, { sheetId, tab } = {}) {
  const r = Array.isArray(row) ? row : [];
  const adminRow = Number(rowIndex) + 2;
  const estadoRaw = String(readAdminCell(r, "C") ?? "").trim();
  const consulta = String(readAdminCell(r, "I") ?? "").trim();
  const enviadoRaw = String(readAdminCell(r, "N") ?? "").trim();
  const markers = parseConsultaMarkers(consulta);
  const base = sheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
    : "";
  return {
    admin_row: adminRow,
    admin_sheet_url: base,
    admin_tab: tab || "",
    id: String(readAdminCell(r, "A") ?? "").trim(),
    asig: String(readAdminCell(r, "B") ?? "").trim(),
    fecha: String(readAdminCell(r, "D") ?? "").trim(),
    cliente: String(readAdminCell(r, "E") ?? "").trim(),
    canal: String(readAdminCell(r, "F") ?? "").trim(),
    telefono: String(readAdminCell(r, "G") ?? "").trim(),
    zona: String(readAdminCell(r, "H") ?? "").trim(),
    consulta,
    title: deriveTitle(consulta),
    interpretacion_ai: String(readAdminCell(r, "J") ?? "").trim(),
    respuesta_ai: String(readAdminCell(r, "K") ?? "").trim(),
    datos_faltantes: String(readAdminCell(r, "L") ?? "").trim(),
    link: String(readAdminCell(r, "M") ?? "").trim(),
    enviado: /^(true|1|sí|si|yes)$/i.test(enviadoRaw),
    estado: estadoRaw,
    estado_normalized: normalizeEstado(estadoRaw),
    actionable: isActionableEstado(estadoRaw),
    priority: estadoPriority(estadoRaw),
    // Deprecated: there is no "replay snapshot" column on the live Admin
    // header. Kept in the response shape (empty string) so legacy consumers
    // don't crash on a missing key; writers no longer populate it.
    replay_snapshot_url: "",
    ml_qid: markers.ml_qid || "",
    ml_mlu: markers.ml_mlu || "",
    listing_url: markers.listing_url || "",
  };
}

/**
 * Project a bank of Admin rows (A2:M, already in array form) into the HITL
 * actionable board. Deterministic: stable sort by (priority, fecha desc,
 * adminRow desc) so poll-based clients can diff by rowId.
 */
export function buildHitlBoardSnapshot(rawRows, { sheetId, tab, generatedAt } = {}) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const mapped = rows.map((row, idx) => mapAdminRowToHitlCard(row, idx, { sheetId, tab }));
  const actionable = mapped.filter((c) => c.actionable);
  actionable.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
    return b.admin_row - a.admin_row;
  });
  const snapshot = {
    ok: true,
    generated_at: generatedAt || new Date().toISOString(),
    sheet_id: sheetId || "",
    tab: tab || "",
    counts: {
      sheet_rows: rows.length,
      mapped: mapped.length,
      actionable: actionable.length,
      by_estado: countByEstado(mapped),
    },
    items: actionable,
  };
  snapshot.etag = computeEtag(snapshot);
  return snapshot;
}

export function countByEstado(cards) {
  const out = {};
  for (const c of cards || []) {
    const k = c.estado_normalized || "(blank)";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/**
 * Stable ETag over the actionable payload. Excludes `generated_at` so a
 * fresh poll with no data change still returns the same ETag → 304 cheap.
 */
export function computeEtag(snapshot) {
  const payload = JSON.stringify({
    counts: snapshot.counts,
    items: (snapshot.items || []).map((it) => ({
      admin_row: it.admin_row,
      estado: it.estado,
      respuesta_ai: it.respuesta_ai,
      link: it.link,
      replay_snapshot_url: it.replay_snapshot_url,
      consulta_len: String(it.consulta || "").length,
    })),
  });
  return 'W/"' + crypto.createHash("sha1").update(payload).digest("hex") + '"';
}

/**
 * Legacy board.json compat projection — the HITL Vercel app currently reads
 * ML HITL packs that have `qid`, `title`, `url`, `status`. Produce the same
 * flat shape so bmc-cola-hitl can swap data sources with zero UI change.
 */
export function projectBoardJsonCompat(snapshot) {
  return (snapshot.items || []).map((it) => ({
    source: "admin",
    admin_row: it.admin_row,
    qid: it.ml_qid || it.id || `ADMIN-${it.admin_row}`,
    title: it.title || it.cliente || `Fila ${it.admin_row}`,
    url: it.listing_url || it.link || snapshot.sheet_id
      ? `${snapshot.sheet_id ? `https://docs.google.com/spreadsheets/d/${snapshot.sheet_id}/edit` : ""}`
      : "",
    status: it.estado || "",
    cliente: it.cliente,
    canal: it.canal,
    zona: it.zona,
    consulta: it.consulta,
    respuesta_ai: it.respuesta_ai,
    link: it.link,
  }));
}

/**
 * Validate a /api/hitl/row/update body. Does not touch the sheet; returns
 * a `{ ok, patch, error }` shape so the route can issue a clean 400 with
 * a stable message and the lib can be unit-tested without a sheets client.
 */
/**
 * Patchable fields → LIVE header columns.
 *   estado             → C
 *   interpretacion     → J (Interpretación AI, new patchable field)
 *   respuesta          → K (Respuesta AI)
 *   datos_faltantes    → L (Datos Faltantes, new patchable field)
 *   link / presupuesto → M (PRESUPUESTO)
 *
 * `replay_snapshot_url` is NOT patchable: the Admin. header has no column
 * for the GCS JSON replay URL. Accepting it would re-create the pre-
 * realignment bug (writing it into M would overwrite PRESUPUESTO).
 */
const PATCHABLE_FIELDS = Object.freeze({
  estado: { col: "C", maxLen: 80 },
  interpretacion: { col: "J", maxLen: 4000 },
  interpretacion_ai: { col: "J", maxLen: 4000 },
  respuesta: { col: "K", maxLen: 4000 },
  respuesta_ai: { col: "K", maxLen: 4000 },
  datos_faltantes: { col: "L", maxLen: 2000 },
  link: { col: "M", maxLen: 2048 },
  presupuesto: { col: "M", maxLen: 2048 },
});

/** Deprecated fields silently accepted (and dropped) so legacy callers don't 400. */
const DROPPED_FIELDS = Object.freeze(["replay_snapshot_url"]);

export function validateRowUpdate(body) {
  const b = body && typeof body === "object" ? body : {};
  const row = Number(b.admin_row ?? b.adminRow ?? b.row);
  if (!Number.isFinite(row) || row < 2 || row > 100000) {
    return { ok: false, error: "admin_row debe ser un entero >= 2" };
  }
  const patch = {};
  const dropped = [];
  for (const key of Object.keys(b)) {
    if (DROPPED_FIELDS.includes(key)) {
      if (b[key] !== undefined && b[key] !== null && String(b[key]).length > 0) {
        dropped.push(key);
      }
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(PATCHABLE_FIELDS, key)) continue;
    const spec = PATCHABLE_FIELDS[key];
    const v = b[key];
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (s.length > spec.maxLen) {
      return { ok: false, error: `${key} supera ${spec.maxLen} chars` };
    }
    // Normalise aliases to the canonical patch key.
    let canonical = key;
    if (key === "respuesta_ai") canonical = "respuesta";
    else if (key === "interpretacion_ai") canonical = "interpretacion";
    else if (key === "presupuesto") canonical = "link";
    patch[canonical] = s;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nada para actualizar (estado/respuesta/link/interpretacion/datos_faltantes)" };
  }
  const out = { ok: true, admin_row: row, patch };
  if (dropped.length > 0) out.dropped = dropped;
  return out;
}

export const _internals = { PATCHABLE_FIELDS, DROPPED_FIELDS, ESTADO_PRIORITY, ACTIONABLE_SET, ADMIN_COL_INDEX };
