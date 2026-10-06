/**
 * adminSheetSchema.js — single source of truth for the Admin. sheet layout.
 *
 * Live header (sheet 1Ie0KCpg…OQuu0, tab `Admin.`, as verified 2026-10-06):
 *
 *   A = ID / link correlación (humans leave empty; writers put MAN-/WA-/ML-/FB-/IG-/EM-/WBK-…)
 *   B = Asig.
 *   C = Estado
 *   D = Fecha
 *   E = Cliente
 *   F = Origen            (prefer short codes: WA / ML / FB / IG / VW / EM / CL / LO / LL)
 *   G = Teléfono-Contacto
 *   H = Dirección / Zona
 *   I = Consulta
 *   J = Interpretación AI
 *   K = Respuesta AI
 *   L = Datos Faltantes
 *   M = PRESUPUESTO       (PDF/Drive hyperlink)
 *   N = Enviado           (checkbox: TRUE/FALSE)
 *
 * Writers must ONLY use the letters above. Anything beyond N is legacy and
 * must stay untouched.
 *
 * Historic bug (pre-realignment, see PR body + evidence packs
 * admin-bloque-columnas-corridas / admin-mapa-columnas-completo):
 * `row-create`, `appendAdminInboundRow`, `/row`, `/quote-batch` and the HITL
 * board all assumed `A=ID B=Fecha C=? D=Tel … L=Estado M=Replay`, which
 * silently overwrote Interpretación AI, Respuesta AI, Datos Faltantes and
 * PRESUPUESTO on real human rows. This module centralises the schema so a
 * mismatch fails closed on `validateAdminHeader()` instead of corrupting the
 * sheet.
 */

export const ADMIN_COLUMNS = Object.freeze([
  { letter: "A", key: "id", header: "" }, // human rows leave A empty; A1 may contain a Drive URL pasted by error.
  { letter: "B", key: "asig", header: "Asig." },
  { letter: "C", key: "estado", header: "Estado" },
  { letter: "D", key: "fecha", header: "Fecha" },
  { letter: "E", key: "cliente", header: "Cliente" },
  { letter: "F", key: "origen", header: "Origen" },
  { letter: "G", key: "telefono", header: "Telefono-Contacto" },
  { letter: "H", key: "zona", header: "Direccion / Zona" },
  { letter: "I", key: "consulta", header: "Consulta" },
  { letter: "J", key: "interpretacion_ai", header: "Interpretacion AI" },
  { letter: "K", key: "respuesta_ai", header: "Respuesta AI" },
  { letter: "L", key: "datos_faltantes", header: "Datos Faltantes" },
  { letter: "M", key: "presupuesto", header: "PRESUPUESTO" },
  { letter: "N", key: "enviado", header: "Enviado" },
]);

/** Column letter → 0-based index. */
export const ADMIN_COL_INDEX = Object.freeze(
  ADMIN_COLUMNS.reduce((acc, c, i) => Object.assign(acc, { [c.letter]: i }), {}),
);

/** Semantic key → 0-based index. */
export const ADMIN_KEY_INDEX = Object.freeze(
  ADMIN_COLUMNS.reduce((acc, c, i) => Object.assign(acc, { [c.key]: i }), {}),
);

/** First and last A1-letter the writers may touch. */
export const ADMIN_RANGE_START = "A";
export const ADMIN_RANGE_END = "N";
export const ADMIN_RANGE_WIDTH = ADMIN_COLUMNS.length; // 14

/** Default state written on create. */
export const ADMIN_ESTADO_PENDIENTE = "Pendiente";
export const ADMIN_ESTADO_APROBADO = "Aprobado";

/** Prefix used for the ID in column A per channel. Keep in sync with ADMIN_INBOUND_ORIGEN. */
export const ADMIN_INBOUND_ID_PREFIX = Object.freeze({
  WA: "WA-",
  ML: "ML-",
  FB: "FB-",
  IG: "IG-",
  EM: "EM-",
  VW: "VW-",
});

/**
 * Origen column (F) — the live sheet mixes short codes (WA/ML/FB/IG/VW)
 * and long labels (WhatsApp/Mercado Libre/Facebook/Email). The task mandate
 * (2026-10-06, Matías) is to prefer the short codes; aliases are kept so
 * reader code (e.g. R-0059 bots, HITL filters) can still recognise both.
 */
export const ADMIN_ORIGEN_SHORT = Object.freeze({
  WA: "WA",
  ML: "ML",
  FB: "FB",
  IG: "IG",
  VW: "VW",
  EM: "EM",
  CL: "CL",
  LO: "LO",
  LL: "LL",
});

/** channel → canonical short code written in F. Case-insensitive input. */
export function adminOrigenShort(channel) {
  const code = String(channel ?? "").trim().toUpperCase();
  if (!code) return "";
  if (ADMIN_ORIGEN_SHORT[code]) return ADMIN_ORIGEN_SHORT[code];
  // Tolerate long labels / aliases from legacy writers.
  const compact = code.replace(/[\s_-]+/g, " ").trim();
  switch (compact) {
    case "WHATSAPP":
    case "WA":
    case "WA ":
      return "WA";
    case "MERCADO LIBRE":
    case "MERCADOLIBRE":
    case "ML":
    case "ML ":
      return "ML";
    case "FACEBOOK":
    case "MESSENGER":
    case "FB":
      return "FB";
    case "INSTAGRAM":
    case "IG":
      return "IG";
    case "EMAIL":
    case "MAIL":
    case "CORREO":
    case "EM":
    case "EM ":
      return "EM";
    case "VOICE WIDGET":
    case "STOREFRONT":
    case "PANELIN":
    case "VW":
      return "VW";
    case "CLIENTE FISICO":
    case "CLIENTE FÍSICO":
    case "CL":
      return "CL";
    case "LOCAL":
    case "LOCAL OFICINA":
    case "LOCAL/OFICINA":
    case "SHOWROOM":
    case "LO":
      return "LO";
    case "LLAMADA":
    case "LL":
      return "LL";
    default:
      return code; // unknown → write what the caller passed (upper-cased), do not fail.
  }
}

/**
 * Normalise a header string the way we compare row 1 against ADMIN_COLUMNS:
 * trim, collapse whitespace, lower-case. Live sheet has strings like
 * `Fecha ` and `            Consulta ` — the leading/trailing spaces are
 * irrelevant for the mapping.
 */
export function normalizeHeaderCell(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Validate the live header against ADMIN_COLUMNS.
 * `headerRow` is the raw array returned by `values.get` for row 1.
 *
 * - Column A header is NOT checked (live A1 contains an accidental Drive URL).
 * - Column N header must contain the word "enviado" so we never write the
 *   Enviado checkbox into some other column by accident.
 * - Columns B..M must match the expected labels (normalised).
 *
 * Returns `{ ok: true }` on match, or `{ ok: false, mismatches: [...] }`.
 * Writers MUST fail closed when `ok === false`.
 */
export function validateAdminHeader(headerRow) {
  const row = Array.isArray(headerRow) ? headerRow : [];
  const mismatches = [];
  for (let i = 1; i < ADMIN_COLUMNS.length; i++) {
    const spec = ADMIN_COLUMNS[i];
    const expected = normalizeHeaderCell(spec.header);
    const actual = normalizeHeaderCell(row[i]);
    if (!expected) continue;
    if (actual !== expected) {
      mismatches.push({ col: spec.letter, expected: spec.header, got: String(row[i] ?? "") });
    }
  }
  return mismatches.length === 0 ? { ok: true } : { ok: false, mismatches };
}

/**
 * Build an aligned Admin row (14 cells, A..N) from a partial object keyed
 * by column letter or semantic key. Missing cells become "". Never widens
 * past N, so writers can't accidentally spill into the legacy ficha
 * técnica columns (O..AC).
 */
export function buildAdminRow(partial = {}) {
  const row = new Array(ADMIN_RANGE_WIDTH).fill("");
  for (const [k, v] of Object.entries(partial)) {
    const upper = k.length === 1 ? k.toUpperCase() : k;
    const letterIdx = ADMIN_COL_INDEX[upper];
    const keyIdx = ADMIN_KEY_INDEX[k];
    const idx = Number.isInteger(letterIdx) ? letterIdx : keyIdx;
    if (!Number.isInteger(idx)) continue;
    row[idx] = v == null ? "" : v;
  }
  return row;
}

/** Read a cell from a row (array) by column letter or semantic key. */
export function readAdminCell(row, letterOrKey) {
  if (!Array.isArray(row)) return "";
  const upper = letterOrKey.length === 1 ? letterOrKey.toUpperCase() : letterOrKey;
  const idx = ADMIN_COL_INDEX[upper] ?? ADMIN_KEY_INDEX[letterOrKey];
  if (!Number.isInteger(idx)) return "";
  return row[idx] ?? "";
}

/**
 * Extract Mercado Libre QIDs that live inside a Consulta cell as
 * `— Q:<qid>` (added by `buildInboundConsulta`). Returns an array of
 * string qids (digits only). Used by the inbound dedup to detect that an
 * HITL human copy of a ML question already covers the incoming webhook.
 */
export function extractConsultaQids(consulta) {
  const out = [];
  const s = String(consulta ?? "");
  if (!s) return out;
  const re = /Q\s*:\s*(\d{6,})/gi;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[1]);
  return out;
}
