/**
 * Parsea una fila de CRM_Operativo leída como rango A:AK (una sola fila de valores).
 * Índices 0-based desde columna A.
 */

/**
 * Extracts a PDF/quote URL from the raw cell value returned by sheets.values.get.
 * When a cell contains a HYPERLINK formula, values.get returns the display label
 * (e.g. "44", "45") instead of the actual href. Only values that already start with
 * "http://" or "https://" are real URLs; everything else is treated as null.
 * @param {unknown} cellValue
 * @returns {string|null}
 */
function extractPdfUrl(cellValue) {
  const s = String(cellValue ?? "").trim();
  return s.startsWith("http://") || s.startsWith("https://") ? s : null;
}

/** @param {string[][]} values - requestBody.values de Sheets (una fila) */
export function parseCrmRowAtoAK(values) {
  const v = values?.[0] || [];
  const get = (i) => (v[i] != null ? String(v[i]).trim() : "");
  return {
    fecha: get(1), // B
    cliente: get(2), // C
    telefono: get(3), // D
    ubicacion: get(4), // E
    origen: get(5), // F
    consulta: get(6), // G
    estado: get(9), // J
    observaciones: get(22), // W
    respuestaSugerida: get(31), // AF
    providerIa: get(32), // AG
    linkPresupuesto: extractPdfUrl(get(33)), // AH — null when cell holds display label, not real URL
    aprobadoEnviar: get(34), // AI
    enviadoEl: get(35), // AJ
    bloquearAuto: get(36), // AK
  };
}

/** @param {string} obs */
export function extractMlQuestionId(obs) {
  const m = String(obs || "").match(/Q:(\d+)/);
  return m ? m[1] : null;
}

/** @param {string} s */
export function isSi(s) {
  const t = String(s || "").trim().toLowerCase();
  return t === "sí" || t === "si" || t === "s" || t === "yes" || t === "true" || t === "1";
}
