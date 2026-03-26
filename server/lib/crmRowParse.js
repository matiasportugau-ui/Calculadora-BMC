/**
 * Parsea una fila de CRM_Operativo leída como rango A:AK (una sola fila de valores).
 * Índices 0-based desde columna A.
 */

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
    linkPresupuesto: get(33), // AH
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
