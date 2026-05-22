/**
 * readEnviados.js — Lee filas de la tab Enviados con la SCHEMA configurada.
 *
 * APIs:
 *   discoverHeaders()                 → { headers: [{col, value}], sampleRows }
 *   readRowsRange(fromRow, toRow)     → [parsedRow]
 *   readRowsByDate(fromIso, toIso)    → [parsedRow]   (filtra después de leer)
 *   readAll()                         → [parsedRow]   (cuidado en tabs grandes)
 */

import { readRange } from "./sheetsClient.js";
import { SCHEMA, TAB_NAME, HEADER_ROW, FIRST_DATA_ROW, LAST_COL, parseRow, indexToCol } from "./enviadosSchema.js";

function quoteTab(name) {
  return /[^A-Za-z0-9_]/.test(name) ? `'${name}'` : name;
}

export async function discoverHeaders() {
  const range = `${quoteTab(TAB_NAME)}!A${HEADER_ROW}:${LAST_COL}${HEADER_ROW + 4}`;
  const rows = await readRange(range);
  const headers = (rows[0] || []).map((v, i) => ({
    col: indexToCol(i),
    value: v,
    mapped: SCHEMA.find((s) => s.col === indexToCol(i))?.field || null,
  }));
  const sampleRows = rows.slice(1).map((r, idx) => parseRow(r, FIRST_DATA_ROW + idx));
  return { headers, sampleRows };
}

export async function readRowsRange(fromRow, toRow) {
  if (fromRow < FIRST_DATA_ROW || toRow < fromRow) {
    throw new Error(`Rango inválido: ${fromRow}-${toRow}`);
  }
  const range = `${quoteTab(TAB_NAME)}!A${fromRow}:${LAST_COL}${toRow}`;
  const rows = await readRange(range);
  return rows.map((r, idx) => parseRow(r, fromRow + idx));
}

export async function readRowsByDate(fromIso, toIso, { maxRows = 500 } = {}) {
  const range = `${quoteTab(TAB_NAME)}!A${FIRST_DATA_ROW}:${LAST_COL}`;
  const rows = await readRange(range);
  const parsed = rows.map((r, idx) => parseRow(r, FIRST_DATA_ROW + idx));
  const from = fromIso ? new Date(fromIso).getTime() : -Infinity;
  const to = toIso ? new Date(toIso).getTime() : Infinity;
  return parsed
    .filter((row) => {
      if (!row.fecha) return false;
      const t = new Date(row.fecha).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    })
    .slice(0, maxRows);
}

export async function readAll({ maxRows = 1000 } = {}) {
  const range = `${quoteTab(TAB_NAME)}!A${FIRST_DATA_ROW}:${LAST_COL}`;
  const rows = await readRange(range);
  return rows.slice(0, maxRows).map((r, idx) => parseRow(r, FIRST_DATA_ROW + idx));
}
