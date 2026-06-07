/**
 * wolfboardOutcome — project Admin 2.0 col L "Estado" (free-form Spanish
 * strings written by Ventas) to a stable outcome enum at read-time.
 *
 * Decision Alt-B from drafts/01-outcome-rbac-proposal.md: Sheet stays as
 * source-of-truth (no GCS migration). Mapper is the contract; consumers
 * (UI KPIs, analytics) get a stable enum, not free-form text.
 *
 * Extracted from server/routes/wolfboard.js so unit tests don't drag in
 * googleapis / anthropic / sheet-side deps.
 */

const OUTCOME_MAP = {
  "": null,
  "enviado": "awaiting_reply",
  "en espera": "awaiting_reply",
  "esperando": "awaiting_reply",
  "ok": "won",
  "aprobado": "awaiting_reply",
  "cerrado": "won",
  "cerrado ok": "won",
  "ganado": "won",
  "perdido": "lost",
  "abandonado": "lost",
  "rechazado": "lost",
};

/**
 * @param {unknown} estadoRaw — string from col L of Admin 2.0.
 * @returns {"won"|"lost"|"awaiting_reply"|null} stable outcome enum,
 *   or null if estadoRaw is empty / unknown.
 */
export function deriveOutcome(estadoRaw) {
  const k = String(estadoRaw || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(OUTCOME_MAP, k) ? OUTCOME_MAP[k] : null;
}

export { OUTCOME_MAP };
