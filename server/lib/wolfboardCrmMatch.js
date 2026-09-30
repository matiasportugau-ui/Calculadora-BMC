/**
 * Admin 2.0 ↔ CRM_Operativo row matching for Wolfboard sync /row / quote-batch.
 *
 * Prefer correlation id (Admin A ↔ CRM A). Text fallback (CRM G / W stem) only
 * hits **unbound** CRM rows. Once CRM A is set, updates must go through id match
 * — otherwise duplicate Admin consultas (e.g. shared storefront seed text) steal
 * AF from another lead during quote-batch or sync.
 */

/** 0-based indices when reading `CRM_Operativo!A4:AK` as row[] (A = 0). */
export const CRM_INDEX = Object.freeze({ A: 0, G: 6, W: 22 });

export function normalizeText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCorrelationId(s) {
  return String(s ?? "").trim();
}

/**
 * First segment of observaciones (W): Wolfboard / appendQuoteToCrm joins
 * `consulta — PDF: …` with a spaced dash; split keeps the original consulta stem.
 */
export function observacionesConsultaStem(w) {
  const s = String(w ?? "").trim();
  if (!s) return "";
  const seg = s.split(/\s+[—–−-]\s+/)[0] || s;
  return String(seg).trim();
}

/** True if CRM row G or W (full or stem) matches Admin consulta after normalizeText. */
export function consultaMatchesCrmRow(cr, consultaRaw) {
  const q = normalizeText(consultaRaw);
  if (!q) return false;
  const g = normalizeText(cr.G);
  const wFull = normalizeText(cr.W);
  const wStem = normalizeText(observacionesConsultaStem(cr.W));
  return (g && g === q) || (wFull && wFull === q) || (wStem && wStem === q);
}

/**
 * Unbound text matches for an Admin consulta (bottom-up order = newest first).
 * Bound rows (corrId set) are excluded — they are id-only.
 */
export function findUnboundCrmRowsByConsulta(crmRows, consulta) {
  if (!String(consulta ?? "").trim()) return [];
  const out = [];
  for (let i = (crmRows || []).length - 1; i >= 0; i--) {
    const cr = crmRows[i];
    if (normalizeCorrelationId(cr.corrId)) continue;
    if (consultaMatchesCrmRow(cr, consulta)) out.push(cr);
  }
  return out;
}

/**
 * Match Admin ↔ CRM: prefer **column A** (corr. id) on both sheets; else unique
 * unbound text (G/W). Ambiguous duplicate unbound text → no match (caller may create).
 * @returns {{ cr: object, matchKind: "id"|"text" }|null}
 */
export function findCrmRowForWolfboard(crmRows, consulta, correlationId) {
  const rows = crmRows || [];
  const cid = normalizeCorrelationId(correlationId);
  if (cid) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const cr = rows[i];
      const a = normalizeCorrelationId(cr.corrId);
      if (a && a === cid) return { cr, matchKind: "id" };
    }
  }
  const unbound = findUnboundCrmRowsByConsulta(rows, consulta);
  if (unbound.length === 1) return { cr: unbound[0], matchKind: "text" };
  return null;
}

export function mapCrmRowsForWolfboardMatch(values) {
  return (values || []).map((row, idx) => ({
    _rowNum: idx + 4,
    corrId: String(row[CRM_INDEX.A] ?? "").trim(),
    G: String(row[CRM_INDEX.G] ?? "").trim(),
    W: String(row[CRM_INDEX.W] ?? "").trim(),
  }));
}
