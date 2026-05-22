/**
 * enviadosSchema.js — Mapeo columnas → campos para la tab `Enviados` de la
 * planilla 2.0 Administrador de Cotizaciones.
 *
 * El mapeo A..M se infirió de `server/lib/adminCotAppend.js` (que escribe esa
 * tab) y de `evals/fixtures/carmen-fila-13.json` (caso real). Las columnas N+
 * son extensión — completar a medida que se confirmen ejecutando
 * `npm run evals:discover` y revisando los headers reales.
 *
 * Para ajustar el mapeo:
 *   1. Correr `npm run evals:discover` y mirar los headers detectados
 *   2. Actualizar SCHEMA[] con (col, field, transform?)
 *   3. Re-correr `npm run evals:ingest`
 */

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (v == null ? null : String(v).trim() || null);
const url = (v) => {
  const s = str(v);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : null;
};

/**
 * Cada entrada: { col: "A"..., field: nombreCampo, transform: (raw) => parsed }
 * Si una columna no está mapeada, el reader la incluye en `extra: { COL: raw }`.
 */
export const SCHEMA = [
  { col: "A", field: "correlation_id", transform: str },
  { col: "B", field: "fecha", transform: str },
  { col: "C", field: "asignado", transform: str },
  { col: "D", field: "telefono", transform: str },
  { col: "E", field: "cliente", transform: str },
  { col: "F", field: "origen", transform: str },
  { col: "G", field: "estado", transform: str },
  { col: "H", field: "direccion_zona", transform: str },
  { col: "I", field: "consulta", transform: str },
  { col: "J", field: "comentarios", transform: str },
  { col: "K", field: "link_pdf", transform: url },
  { col: "L", field: "status_workflow", transform: str },
  { col: "M", field: "replay_snapshot_url", transform: url },
  { col: "N", field: "monto_total", transform: num },
  { col: "O", field: "moneda", transform: str },
];

export const TAB_NAME = process.env.BMC_ENVIADOS_TAB || "Enviados";

export const HEADER_ROW = 1;
export const FIRST_DATA_ROW = 2;
export const LAST_COL = "Z";

export function colIndex(letter) {
  let i = 0;
  for (const ch of letter.toUpperCase()) {
    i = i * 26 + (ch.charCodeAt(0) - 64);
  }
  return i - 1;
}

export function parseRow(rawRow, rowNumber) {
  const obj = {
    _rowNumber: rowNumber,
    extra: {},
  };
  for (const { col, field, transform } of SCHEMA) {
    const raw = rawRow[colIndex(col)] ?? null;
    obj[field] = transform ? transform(raw) : raw;
  }
  for (let i = 0; i < rawRow.length; i++) {
    const used = SCHEMA.some((s) => colIndex(s.col) === i);
    if (!used && rawRow[i] != null && rawRow[i] !== "") {
      const letter = indexToCol(i);
      obj.extra[letter] = rawRow[i];
    }
  }
  return obj;
}

export function indexToCol(idx) {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
