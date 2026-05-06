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
import { defaultTailAHAK } from "./crmOperativoLayout.js";

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
 * @returns {Promise<{ok:true,row:number|null,sheetId:string}|{ok:false,error:string}>}
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
    const cliente = String(input.cliente || "").trim() || "—";
    const telefono = String(input.telefono || "").trim();
    const ubicacion = String(input.ubicacion || "").trim();
    const scenario = String(input.scenario || "").trim();
    const lista = String(input.lista || "").trim();
    const total = Number(input.total || 0);
    const pdfUrl = String(input.pdf_url || "").trim();
    const driveUrl = String(input.drive_url || "").trim();
    const vendedor = String(input.vendedor || "").trim();
    const tipoCliente = String(input.tipo_cliente || "").trim();
    const urgencia = String(input.urgencia || "").trim();
    const probabilidad = String(input.probabilidad_cierre || "").trim();

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

    // Escribir toda la fila B:AK en una sola operación append para evitar
    // carreras entre lecturas/escrituras separadas al guardar concurrentemente.
    const tail = defaultTailAHAK();
    tail[0] = pdfUrl || driveUrl || ""; // AH = LINK_PRESUPUESTO

    const rowValues = [
      // B–K
      now,
      cliente,
      telefono,
      ubicacion,
      "Calculadora-Panelin",
      resumenPedido,
      "Cotización",
      "",
      "Pendiente",
      vendedor,
      // L–Q
      "",
      "",
      "",
      "",
      "",
      "",
      // R–T
      probabilidad,
      urgencia,
      "No",
      // U
      "",
      // V–W
      tipoCliente,
      observaciones,
      // X–AG
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      // AH–AK
      ...tail,
    ];

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'CRM_Operativo'!B:AK`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowValues] },
    });

    const updatedRange = appendRes?.data?.updates?.updatedRange || "";
    const appendedRow = Number((updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/) || [])[1] || 0);

    return { ok: true, row: appendedRow || null, sheetId };
  } catch (err) {
    return { ok: false, error: err.message || "Error desconocido al escribir en Sheets" };
  }
}
