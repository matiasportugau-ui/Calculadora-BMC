/**
 * evalsRead.js — Proxy de lectura de la tab Enviados para el harness de evals.
 *
 * Endpoints:
 *   GET /api/admin-cot/enviados/discover
 *     → { sheetId, headers:[{col,value,mapped}], sampleRows:[parsedRow] }
 *
 *   GET /api/admin-cot/enviados?from=N&to=M
 *   GET /api/admin-cot/enviados?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
 *     → { sheetId, rows:[parsedRow] }
 *
 * Auth: si BMC_EVALS_API_TOKEN está set en el server, requiere
 *       `Authorization: Bearer <token>`. Si no está set, el endpoint está
 *       deshabilitado (404) — política conservadora para no exponer la
 *       planilla por accidente.
 *
 * Reusa googleAuthCache para auth (misma SA que el resto del API).
 * Schema de columnas: las mismas constantes que evals/lib/enviadosSchema.js
 * pero duplicadas acá para no acoplar server con el harness — si cambia el
 * schema en un lado, hay que sincronizar en el otro (test en CI puede chequear).
 */

import express from "express";
import { google } from "googleapis";
import { getGoogleAuthClient } from "../lib/googleAuthCache.js";
import config from "../config.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const SCHEMA = [
  { col: "A", field: "correlation_id", kind: "str" },
  { col: "B", field: "fecha", kind: "str" },
  { col: "C", field: "asignado", kind: "str" },
  { col: "D", field: "telefono", kind: "str" },
  { col: "E", field: "cliente", kind: "str" },
  { col: "F", field: "origen", kind: "str" },
  { col: "G", field: "estado_inicial", kind: "str" },
  { col: "H", field: "direccion_zona", kind: "str" },
  { col: "I", field: "consulta", kind: "str" },
  { col: "J", field: "respuesta_ia", kind: "str" },
  { col: "K", field: "link_pdf", kind: "url" },
  { col: "L", field: "estado", kind: "str" },
  { col: "M", field: "replay_snapshot_url", kind: "url" },
  { col: "N", field: "monto_total", kind: "num" },
  { col: "O", field: "moneda", kind: "str" },
];
const LAST_COL = "Z";
const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;
const TAB_NAME = process.env.WOLFB_ADMIN_COT_ENVIADOS_TAB || "Enviados";

const colIndex = (letter) => {
  let i = 0;
  for (const ch of String(letter).toUpperCase()) {
    i = i * 26 + (ch.charCodeAt(0) - 64);
  }
  return i - 1;
};
const indexToCol = (idx) => {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
};
const toNum = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const toStr = (v) => (v == null ? null : String(v).trim() || null);
const toUrl = (v) => {
  const s = toStr(v);
  return s && /^https?:\/\//i.test(s) ? s : null;
};
const transform = (kind, raw) => {
  if (kind === "num") return toNum(raw);
  if (kind === "url") return toUrl(raw);
  return toStr(raw);
};

function parseRow(rawRow, rowNumber) {
  const obj = { _rowNumber: rowNumber, extra: {} };
  for (const { col, field, kind } of SCHEMA) {
    const raw = rawRow[colIndex(col)] ?? null;
    obj[field] = transform(kind, raw);
  }
  for (let i = 0; i < rawRow.length; i++) {
    const used = SCHEMA.some((s) => colIndex(s.col) === i);
    if (!used && rawRow[i] != null && rawRow[i] !== "") {
      obj.extra[indexToCol(i)] = rawRow[i];
    }
  }
  return obj;
}

function getSheetId() {
  return process.env.WOLFB_ADMIN_SHEET_ID || config?.wolfbAdminSheetId || null;
}

function requireAuth(req, res, next) {
  const expected = process.env.BMC_EVALS_API_TOKEN;
  if (!expected) {
    return res.status(404).json({
      ok: false,
      error: "Endpoint deshabilitado: setear BMC_EVALS_API_TOKEN en el server.",
    });
  }
  const header = req.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m || m[1] !== expected) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

async function getSheets() {
  const auth = await getGoogleAuthClient(SCOPE);
  return google.sheets({ version: "v4", auth });
}

const router = express.Router();

router.get("/api/admin-cot/enviados/discover", requireAuth, async (req, res) => {
  const sheetId = getSheetId();
  if (!sheetId) {
    return res.status(503).json({ ok: false, error: "Falta WOLFB_ADMIN_SHEET_ID" });
  }
  try {
    const sheets = await getSheets();
    const range = `'${TAB_NAME}'!A${HEADER_ROW}:${LAST_COL}${HEADER_ROW + 4}`;
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const values = r.data.values || [];
    const headers = (values[0] || []).map((v, i) => ({
      col: indexToCol(i),
      value: v,
      mapped: SCHEMA.find((s) => s.col === indexToCol(i))?.field || null,
    }));
    const sampleRows = values.slice(1).map((row, idx) => parseRow(row, FIRST_DATA_ROW + idx));
    res.json({ ok: true, sheetId, tab: TAB_NAME, headers, sampleRows });
  } catch (err) {
    req.log?.error({ err: err.message }, "evalsRead.discover failed");
    res.status(503).json({ ok: false, error: err.message });
  }
});

router.get("/api/admin-cot/enviados", requireAuth, async (req, res) => {
  const sheetId = getSheetId();
  if (!sheetId) {
    return res.status(503).json({ ok: false, error: "Falta WOLFB_ADMIN_SHEET_ID" });
  }
  const { from, to, fromDate, toDate, maxRows } = req.query;
  try {
    const sheets = await getSheets();
    let range;
    let fromRow = null;
    if (from && to) {
      const f = Number(from);
      const t = Number(to);
      if (!Number.isFinite(f) || !Number.isFinite(t) || f < FIRST_DATA_ROW || t < f) {
        return res.status(400).json({ ok: false, error: "from/to inválidos" });
      }
      range = `'${TAB_NAME}'!A${f}:${LAST_COL}${t}`;
      fromRow = f;
    } else if (fromDate || toDate) {
      range = `'${TAB_NAME}'!A${FIRST_DATA_ROW}:${LAST_COL}`;
      fromRow = FIRST_DATA_ROW;
    } else {
      return res.status(400).json({ ok: false, error: "Pasar ?from=N&to=M ó ?fromDate=...&toDate=..." });
    }
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    let rows = (r.data.values || []).map((rawRow, idx) => parseRow(rawRow, fromRow + idx));
    if (fromDate || toDate) {
      const fts = fromDate ? new Date(fromDate).getTime() : -Infinity;
      const tts = toDate ? new Date(toDate).getTime() : Infinity;
      rows = rows.filter((row) => {
        if (!row.fecha) return false;
        const t = new Date(row.fecha).getTime();
        return Number.isFinite(t) && t >= fts && t <= tts;
      });
    }
    const cap = Number(maxRows) > 0 ? Number(maxRows) : 500;
    if (rows.length > cap) rows = rows.slice(0, cap);
    res.json({ ok: true, sheetId, tab: TAB_NAME, rows });
  } catch (err) {
    req.log?.error({ err: err.message }, "evalsRead.rows failed");
    res.status(503).json({ ok: false, error: err.message });
  }
});

export default router;
