/**
 * CRM_Operativo — layout del “cockpit” operador (columnas AG–AK) y defaults al crear filas.
 * Cabeceras en fila 3; datos desde fila 4. Fuente de verdad narrativa:
 * docs/team/panelsim/CRM-OPERATIVO-COCKPIT.md
 */

export const CRM_TAB = "CRM_Operativo";
export const HEADER_ROW = 3;
export const FIRST_DATA_ROW = 4;

/** Letras de columnas del bloque extendido (deben existir en fila 3 de la planilla). */
export const Col = {
  /** Modelo que generó la respuesta sugerida (WA / futuro ML-IA). */
  PROVIDER_IA: "AG",
  /** URL al PDF o cotización (hyperlink en celda). */
  LINK_PRESUPUESTO: "AH",
  /** Sí | No — gate humano antes de envío automático. */
  APROBADO_ENVIAR: "AI",
  /** Fecha/hora de envío al canal (vacío = no enviado). */
  ENVIADO_EL: "AJ",
  /** Sí | No — evita que automatismos toquen la fila. */
  BLOQUEAR_AUTO: "AK",
};

/**
 * Valores por defecto para AG–AK al crear una fila desde sync ML (escritura B:AK).
 * AG vacío (sin provider de cadena IA en ese flujo), AH vacío, AI/AK = No, AJ vacío.
 * @returns {[string, string, string, string, string]}
 */
export function defaultTailAGAK_ML() {
  return ["", "", "No", "", "No"];
}

/**
 * Valores por defecto solo AH–AK (WA ya escribió AF:AG).
 * @returns {[string, string, string, string]}
 */
export function defaultTailAHAK() {
  return ["", "No", "", "No"];
}

/**
 * Valores por defecto AG–AK para ingest email (no rellena AF con IA en este endpoint).
 * @returns {[string, string, string, string, string]}
 */
export function defaultTailAGAK_Email() {
  return ["", "", "No", "", "No"];
}

/**
 * @param {number} row — fila 1-based de Sheets
 */
export function rangeAGAK(row) {
  return `'${CRM_TAB}'!${Col.PROVIDER_IA}${row}:${Col.BLOQUEAR_AUTO}${row}`;
}

/**
 * @param {number} row
 */
export function rangeAHAK(row) {
  return `'${CRM_TAB}'!${Col.LINK_PRESUPUESTO}${row}:${Col.BLOQUEAR_AUTO}${row}`;
}
