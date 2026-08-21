/**
 * Recover cut length from covering m² when a modern PDF omits "Xm".
 * L = m² / (qty × AU). Clamp to the same 1.5–14.5 m window as adjunto snapLen.
 */

import { anchoUtilForTipo } from "./panelAnchoUtil.js";

export const LENGTH_RECOVER_MIN_M = 1.5;
export const LENGTH_RECOVER_MAX_M = 14.5;

/**
 * First covering-area figure in text (`113.68 m²` / `113,68 m2`).
 * @param {string} text
 * @returns {number|null}
 */
export function extractCoveringM2(text) {
  const s = String(text || "");
  // Do not use \b after ² — superscript is non-word so \b never fires.
  const re = /(\d{1,4}(?:[.,]\d{1,2})?)\s*m(?:²|2)(?!\d)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(String(m[1]).replace(",", "."));
    if (Number.isFinite(n) && n > 0.5 && n < 5000) return n;
  }
  return null;
}

/**
 * @param {{ m2?: number, cantidad?: number, tipo?: string, au?: number }} input
 * @returns {number|null} length meters at cm precision, or null if out of range
 */
export function recoverPanelLengthFromM2(input = {}) {
  const qty = Math.max(0, Math.floor(Number(input.cantidad) || 0));
  const area = Number(input.m2);
  const au =
    Number.isFinite(Number(input.au)) && Number(input.au) > 0
      ? Number(input.au)
      : anchoUtilForTipo(input.tipo);
  if (!(qty > 0) || !Number.isFinite(area) || area <= 0 || !(au > 0)) return null;
  const L = Math.round((area / (qty * au)) * 100) / 100;
  if (L < LENGTH_RECOVER_MIN_M || L > LENGTH_RECOVER_MAX_M) return null;
  return L;
}

/**
 * Operator-facing notes when L was guessed.
 * @param {Array<{ tipo?: string, espesor?: number, cantidad?: number, longitud?: number, lengthDefaulted?: boolean, lengthInferredFromM2?: boolean }>} paneles
 * @param {string} [rawText]
 * @returns {string[]}
 */
export function lengthSourceWarnings(paneles = [], rawText = "") {
  const warnings = [];
  const zonasM = String(rawText || "").match(/(\d+)\s*zonas/i);
  const multiZona = zonasM && Number(zonasM[1]) >= 2;
  for (const p of paneles) {
    const label = `${p.tipo || "PANEL"} ${p.espesor || "?"}mm ×${p.cantidad || 0}`;
    if (p.lengthInferredFromM2) {
      const au = anchoUtilForTipo(p.tipo);
      warnings.push(
        `Largo ${Number(p.longitud).toFixed(2)}m inferido desde m² (AU ${au} m) en ${label}.` +
          (multiZona ? " Revisá si hay 2 largos distintos." : ""),
      );
    } else if (p.lengthDefaulted) {
      warnings.push(
        `Largo default 6 m en ${label} — no había m² ni metros en el PDF. Ajustá a mano.`,
      );
    }
  }
  return warnings;
}
