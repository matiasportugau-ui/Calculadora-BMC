/**
 * Append a row to the BMC CRM_Operativo sheet for a generated quote.
 *
 * Mirrors the column mapping used by the WhatsApp pipeline in server/index.js
 * (B:K, R:T, V:W, AF:AG, AH-AK). The quote URL goes into column AH
 * (LINK_PRESUPUESTO, see crmOperativoLayout.js).
 *
 * Returns { ok, row, sheetId } on success or { ok: false, error } if the
 * environment isn't configured (no BMC_SHEET_ID / no Google credentials).
 */
import { google } from "googleapis";
import { config } from "../config.js";
import { sanitizeCellValue } from "./sheetsCsvGuard.js";
import { buildCrmRow, validateCrmRow, sliceCrmRange } from "./crmRowMapper.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

async function getSheetsClient() {
  const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) {
    const auth = new google.auth.GoogleAuth({ scopes: [SCOPE] });
    return google.sheets({ version: "v4", auth: await auth.getClient() });
  }
  const auth = new google.auth.GoogleAuth({ keyFile: credsPath, scopes: [SCOPE] });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

/**
 * @param {object} input
 * @param {string} [input.cliente]
 * @param {string} [input.telefono]
 * @param {string} [input.ubicacion]
 * @param {string} [input.scenario]   one of solo_techo | solo_fachada | techo_fachada | camara_frig | presupuesto_libre
 * @param {string} [input.lista]      web | venta
 * @param {number} [input.total]      USD with IVA
 * @param {string} [input.pdf_url]    GCS or in-memory URL
 * @param {string} [input.drive_url]  Drive webViewLink (optional)
 * @param {string} [input.vendedor]
 * @param {string} [input.observaciones]
 * @param {string} [input.tipo_cliente]
 * @param {string} [input.urgencia]
 * @param {string} [input.probabilidad_cierre]
 * @param {string} [input.correlation_id]  Wolfboard / Admin col A — written to CRM column A when set
 * @returns {Promise<{ok:true,row:number,sheetId:string}|{ok:false,error:string}>}
 */
export async function appendQuoteToCrm(input = {}) {
  const sheetId = config.bmcSheetId;
  if (!sheetId) {
    return { ok: false, error: "BMC_SHEET_ID no configurado — no se puede escribir en CRM_Operativo" };
  }

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    return { ok: false, error: `Google auth falló: ${err.message}` };
  }

  try {
    const now = new Date().toISOString();
    const scenario = String(input.scenario || "").trim();
    const lista = String(input.lista || "").trim();
    const total = Number(input.total || 0);
    const pdfUrl = String(input.pdf_url || "").trim();
    const driveUrl = String(input.drive_url || "").trim();
    // correlationId is written separately to column A, so guard it here.
    const correlationId = sanitizeCellValue(String(input.correlation_id || "").trim());

    const resumenPedido = [
      scenario ? `[${scenario}]` : "",
      lista ? `lista=${lista}` : "",
      total ? `total=USD ${total.toFixed(2)} c/IVA` : "",
    ].filter(Boolean).join(" ");

    const obsBase = String(input.observaciones || "").trim();
    const obsLinks = [
      pdfUrl ? `PDF: ${pdfUrl}` : "",
      driveUrl ? `Drive: ${driveUrl}` : "",
    ].filter(Boolean).join(" | ");
    const observaciones = [obsBase, obsLinks].filter(Boolean).join(" — ");

    // Read row-3 headers + the Cliente column in one round-trip. Headers anchor
    // the write by column NAME (not blind position); the C column locates the
    // first empty data row for the fallback row number.
    const reads = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: ["'CRM_Operativo'!A3:ZZ3", "'CRM_Operativo'!C4:C500"],
    });
    const headers = reads.data.valueRanges?.[0]?.values?.[0] || [];
    const clienteRows = reads.data.valueRanges?.[1]?.values || [];
    let row = clienteRows.length + 4;
    for (let i = 0; i < clienteRows.length; i++) {
      if (!clienteRows[i][0] || !String(clienteRows[i][0]).trim()) {
        row = i + 4;
        break;
      }
    }

    // KEY-BASED row: every column addressed by logical key, never by array index.
    // Missing fields stay "" — no omitted key can shift later columns left.
    const lead = {
      fecha: now,
      cliente: String(input.cliente || "").trim() || "—",
      telefono: String(input.telefono || "").trim(),
      ubicacion: String(input.ubicacion || "").trim(),
      origen: "Calculadora-Panelin",
      consulta: resumenPedido,
      categoria: "Cotización",
      estado: "Pendiente",
      responsable: String(input.vendedor || "").trim(),
      probabilidad: String(input.probabilidad_cierre || "").trim(),
      urgencia: String(input.urgencia || "").trim(),
      validarStock: "No",
      tipoCliente: String(input.tipo_cliente || "").trim(),
      observaciones,
      providerIa: "",
      linkPresupuesto: pdfUrl || driveUrl || "", // AH = LINK_PRESUPUESTO
      aprobadoEnviar: "No",
      enviadoEl: "",
      bloquearAuto: "No",
    };

    const built = buildCrmRow(headers, lead, { sanitize: sanitizeCellValue });
    // requireHeaders:false — this path historically never read headers, so a
    // failed header read must still write via documented column letters.
    const check = validateCrmRow(built, headers, { requireHeaders: false });
    if (!check.ok || built.fallbacks.length) {
      console.warn(
        `[crmAppend] CRM_Operativo header drift — errors=${check.errors.join(",") || "none"} fallbacks=${built.fallbacks.join(",") || "none"}`
      );
    }

    // Escribir toda la fila B:AK en una sola operación append para evitar
    // carreras entre lecturas/escrituras separadas al guardar concurrentemente.
    const rowValues = sliceCrmRange(built.row, "B", "AK");

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'CRM_Operativo'!B:AK`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowValues] },
    });

    const updatedRange = appendRes?.data?.updates?.updatedRange || "";
    const appendedRow = Number((updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/) || [])[1] || 0);
    const dataRow = appendedRow || row;

    if (correlationId) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!A${dataRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[correlationId]] },
        });
      } catch {
        // non-fatal; row body already appended
      }
    }

    return { ok: true, row: dataRow, sheetId };
  } catch (err) {
    return { ok: false, error: err.message || "Error desconocido al escribir en Sheets" };
  }
}
