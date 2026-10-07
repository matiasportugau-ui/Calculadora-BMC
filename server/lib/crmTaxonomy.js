/**
 * Lee / escribe taxonomía (cols AL–AN) en CRM_Operativo.
 * Requiere BMC_SHEET_ID y credenciales con scope spreadsheets.
 */
import { google } from "googleapis";
import { config } from "../config.js";
import { CRM_TAB, Col } from "./crmOperativoLayout.js";
import { parseCrmRowAtoAK } from "./crmRowParse.js";
import { sanitizeCellValue } from "./sheetsCsvGuard.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const TIPOS = new Set(["cliente", "proveedor", "lead", "interno", "otro"]);

async function getSheetsClient() {
  const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) {
    const auth = new google.auth.GoogleAuth({ scopes: [SCOPE] });
    return google.sheets({ version: "v4", auth: await auth.getClient() });
  }
  const auth = new google.auth.GoogleAuth({ keyFile: credsPath, scopes: [SCOPE] });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

function normalizeTipo(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (TIPOS.has(t)) return t;
  if (t === "prov" || t === "supplier") return "proveedor";
  if (t === "customer") return "cliente";
  return "";
}

/**
 * @param {string|string[]} tags
 */
function tagsToCell(tags) {
  if (Array.isArray(tags)) {
    return sanitizeCellValue(tags.map((x) => String(x || "").trim()).filter(Boolean).join(", "));
  }
  return sanitizeCellValue(String(tags || "").trim());
}

/**
 * @param {number} rowNum — fila 1-based (≥4)
 * @returns {Promise<{ok:true,row:number,parsed:object}|{ok:false,error:string}>}
 */
export async function readCrmRowTaxonomy(rowNum) {
  const sheetId = config.bmcSheetId;
  if (!sheetId) return { ok: false, error: "BMC_SHEET_ID no configurado" };
  const row = Number(rowNum);
  if (!row || row < 4) return { ok: false, error: "row debe ser >= 4" };

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    return { ok: false, error: `Google auth falló: ${err.message}` };
  }

  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${CRM_TAB}'!A${row}:AN${row}`,
    });
    const parsed = parseCrmRowAtoAK(r.data.values || []);
    return {
      ok: true,
      row,
      parsed,
      taxonomy: {
        tipoContacto: parsed.tipoContacto || "",
        tagsTaxonomia: parsed.tagsTaxonomia || "",
        notasTaxonomia: parsed.notasTaxonomia || "",
      },
    };
  } catch (e) {
    return { ok: false, error: e.message || "Error al leer CRM" };
  }
}

/**
 * Plan AL–AN taxonomy writes. Does not touch Sheets.
 * @param {number} rowNum
 * @param {{ tipoContacto?: string, tags?: string|string[], notas?: string }} fields — solo se escriben los definidos
 */
export function planCrmTaxonomyWrite(rowNum, fields = {}) {
  const row = Number(rowNum);
  if (!row || row < 4) return { ok: false, error: "row debe ser >= 4" };

  const updates = [];
  if (fields.tipoContacto !== undefined) {
    const t = normalizeTipo(fields.tipoContacto);
    if (!t) {
      return {
        ok: false,
        error: `tipoContacto inválido: use uno de ${[...TIPOS].join(", ")}`,
      };
    }
    updates.push({
      range: `'${CRM_TAB}'!${Col.TIPO_CONTACTO}${row}`,
      values: [[sanitizeCellValue(t)]],
    });
  }
  if (fields.tags !== undefined) {
    updates.push({
      range: `'${CRM_TAB}'!${Col.TAGS_TAXONOMIA}${row}`,
      values: [[tagsToCell(fields.tags)]],
    });
  }
  if (fields.notas !== undefined) {
    updates.push({
      range: `'${CRM_TAB}'!${Col.NOTAS_TAXONOMIA}${row}`,
      values: [[sanitizeCellValue(String(fields.notas || "").trim())]],
    });
  }

  if (updates.length === 0) {
    return { ok: false, error: "Nada que escribir — pasá tipoContacto, tags y/o notas" };
  }

  return {
    ok: true,
    row,
    updates,
    written: {
      tipoContacto: fields.tipoContacto !== undefined,
      tags: fields.tags !== undefined,
      notas: fields.notas !== undefined,
    },
    columnLetters: { tipo: "AL", tags: "AM", notas: "AN" },
  };
}

/**
 * @param {number} rowNum
 * @param {{ tipoContacto?: string, tags?: string|string[], notas?: string }} fields — solo se escriben los definidos
 * @param {object} [sheetsOverride] — test seam; production callers omit it
 */
export async function writeCrmRowTaxonomy(rowNum, fields = {}, sheetsOverride) {
  const sheetId = config.bmcSheetId;
  if (!sheetId) return { ok: false, error: "BMC_SHEET_ID no configurado" };
  const plan = planCrmTaxonomyWrite(rowNum, fields);
  if (!plan.ok) return plan;

  let sheets = sheetsOverride;
  if (!sheets) {
    try {
      sheets = await getSheetsClient();
    } catch (err) {
      return { ok: false, error: `Google auth falló: ${err.message}` };
    }
  }

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: plan.updates },
    });
    return {
      ok: true,
      row: plan.row,
      written: plan.written,
      columnLetters: plan.columnLetters,
    };
  } catch (e) {
    return { ok: false, error: e.message || "Error al escribir CRM" };
  }
}
