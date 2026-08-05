/**
 * Ventas → coordination lifecycle chips for /logistica search results (Ops UX F2).
 * Pure functions — column F = estado text; column G = fecha coordinación (ISO).
 */

/** @typedef {'enviado'|'coordinado'|'por_coordinar'} CoordinationStatus */

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeSearchText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * True when "enviado" appears only under negation (NO ENVIADO, sin enviar, etc.).
 * "NO ENVIADO" / "sin enviar" still contain the substring "enviad*".
 * Input should already be normalizeSearchText'd (accents stripped, lowercased).
 * @param {string} n
 * @returns {boolean}
 */
export function hasNegatedEnviado(n) {
  const s = String(n || "");
  if (!s) return false;
  // Optional auxiliaries: "no se ha enviado", "aun no se envio", "no fue enviado".
  return (
    /\bno\s+(se\s+)?(ha\s+|fue\s+|habia\s+)?enviad/.test(s) ||
    /\bsin\s+enviad/.test(s) ||
    /\bno\s+se\s+envi/.test(s) ||
    /\bnunca\s+enviad/.test(s) ||
    /\bpendiente\s+de\s+envi/.test(s) ||
    /\baun\s+no\s+(se\s+)?(ha\s+|fue\s+)?envi/.test(s)
  );
}

/**
 * Classify a mapped Ventas row for operator chips.
 * Enviado / negation is read from **estadoText only** (col F). Never scan
 * rawSheetText — notes/historial with "no enviado" must not override ENVIADO.
 * @param {{
 *   estadoText?: string,
 *   fechaEntrega?: string,
 *   pickupId?: string,
 *   rawSheetText?: string,
 * }} row
 * @returns {{
 *   status: CoordinationStatus,
 *   coordDateIso: string|null,
 *   batchKey: string|null,
 *   label: string,
 * }}
 */
export function classifyVentasCoordination(row = {}) {
  // Ops UX F2: col F estado drives Enviado chip — ignore full-row rawSheetText.
  const n = normalizeSearchText(String(row.estadoText || ""));

  // Negation first: "NO ENVIADO" matches \benviado\b otherwise.
  if (
    !hasNegatedEnviado(n) &&
    (/\benviado\b|\benviada\b|\benviados\b/.test(n) || /\benviad/.test(n))
  ) {
    return {
      status: "enviado",
      coordDateIso: null,
      batchKey: null,
      label: "Enviado",
    };
  }

  const iso = String(row.fechaEntrega || "").trim();
  const coordDateIso = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  if (coordDateIso) {
    return {
      status: "coordinado",
      coordDateIso,
      batchKey: coordDateIso,
      label: "Coordinado",
    };
  }

  return {
    status: "por_coordinar",
    coordDateIso: null,
    batchKey: null,
    label: "Por coordinar",
  };
}

/**
 * Stable pastel color from batch key (same coordination date → same color).
 * @param {string|null|undefined} batchKey
 * @returns {string} css color
 */
export function batchColorFromKey(batchKey) {
  if (!batchKey) return "#94a3b8";
  let h = 0;
  const s = String(batchKey);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 62% 42%)`;
}

/**
 * Format chip secondary text (date dd/mm for Coordinado).
 * @param {{ status: CoordinationStatus, coordDateIso: string|null, label: string }} c
 * @returns {string}
 */
export function coordinationChipCaption(c) {
  if (!c) return "";
  if (c.status === "coordinado" && c.coordDateIso) {
    const parts = c.coordDateIso.split("-");
    const m = parts[1];
    const d = parts[2];
    return `${c.label} · ${d}/${m}`;
  }
  return c.label;
}
