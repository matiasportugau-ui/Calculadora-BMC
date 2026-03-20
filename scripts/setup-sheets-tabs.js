#!/usr/bin/env node
/**
 * Setup Sheets tabs and columns via Google Sheets API.
 * Run from project root: node scripts/setup-sheets-tabs.js
 *
 * Requires:
 * - .env with BMC_PAGOS_SHEET_ID, BMC_VENTAS_SHEET_ID, BMC_STOCK_SHEET_ID, BMC_CALENDARIO_SHEET_ID
 * - GOOGLE_APPLICATION_CREDENTIALS pointing to service-account.json
 * - Workbooks shared with the service account (Editor)
 */
import "dotenv/config";
import { google } from "googleapis";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const IDS = {
  pagos: process.env.BMC_PAGOS_SHEET_ID || "1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI",
  ventas: process.env.BMC_VENTAS_SHEET_ID || "1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue",
  stock: process.env.BMC_STOCK_SHEET_ID || "1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw",
  calendario: process.env.BMC_CALENDARIO_SHEET_ID || "1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk",
};

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE] });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

async function getSpreadsheet(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return res.data;
}

async function addSheetIfMissing(sheets, spreadsheetId, title, headers) {
  const meta = await getSpreadsheet(sheets, spreadsheetId);
  const exists = meta.sheets?.some((s) => s.properties.title === title);
  if (exists) {
    console.log(`  [SKIP] Tab "${title}" ya existe`);
    return;
  }
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  const sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
  console.log(`  [OK] Tab "${title}" creada`);
}

async function addColumnIfMissing(sheets, spreadsheetId, sheetTitle, headerRow, newColumnName) {
  const meta = await getSpreadsheet(sheets, spreadsheetId);
  const sheet = meta.sheets?.find((s) => s.properties.title === sheetTitle);
  if (!sheet) {
    console.log(`  [SKIP] Hoja "${sheetTitle}" no encontrada`);
    return;
  }
  const sheetId = sheet.properties.sheetId;
  const rowIndex = headerRow - 1;

  const rangeRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A${headerRow}:ZZ${headerRow}`,
  });
  const headers = (rangeRes.data.values || [])[0] || [];
  const colIndex = headers.findIndex((h) => String(h || "").trim() === newColumnName);
  if (colIndex >= 0) {
    console.log(`  [SKIP] Columna "${newColumnName}" ya existe en ${sheetTitle}`);
    return;
  }

  const colToLetter = (n) => {
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };
  const nextCol = colToLetter(headers.length);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { appendDimension: { sheetId, dimension: "COLUMNS", length: 1 } },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!${nextCol}${headerRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newColumnName]] },
  });
  console.log(`  [OK] Columna "${newColumnName}" añadida en ${sheetTitle}`);
}

async function addColumnToMensualSheets(sheets, spreadsheetId, newColumnName) {
  const meta = await getSpreadsheet(sheets, spreadsheetId);
  const mensualPattern = /^(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s*\d{4}$/i;
  const sheetsToUpdate = meta.sheets?.filter((s) => mensualPattern.test(s.properties.title)) || [];
  for (const s of sheetsToUpdate) {
    const title = s.properties.title;
    await addColumnIfMissing(sheets, spreadsheetId, title, 1, newColumnName);
  }
}

async function main() {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!creds) {
    console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env");
    process.exit(1);
  }

  const sheets = await getSheetsClient();

  console.log("\n1. Pagos Pendientes 2026 — Tab CONTACTOS");
  await addSheetIfMissing(sheets, IDS.pagos, "CONTACTOS", ["NOMBRE", "EMAIL"]);

  console.log("\n2. 2.0 - Ventas — Tab Ventas_Consolidado");
  await addSheetIfMissing(sheets, IDS.ventas, "Ventas_Consolidado", [
    "COTIZACION_ID",
    "PROVEEDOR",
    "CLIENTE_NOMBRE",
    "FECHA_ENTREGA",
    "COSTO",
    "GANANCIA",
    "SALDO_CLIENTE",
    "PAGO_PROVEEDOR",
    "FACTURADO",
    "NUM_FACTURA",
    "FECHA_INGRESO",
  ]);

  console.log("\n3. Stock E-Commerce — Columna SHOPIFY_SYNC_AT");
  const stockMeta = await getSpreadsheet(sheets, IDS.stock);
  const firstSheet = stockMeta.sheets?.[0]?.properties?.title;
  if (firstSheet) {
    await addColumnIfMissing(sheets, IDS.stock, firstSheet, 3, "SHOPIFY_SYNC_AT");
  } else {
    console.log("  [SKIP] No hay hojas en Stock E-Commerce");
  }

  console.log("\n4. Calendario vencimientos — Columna PAGADO en tabs mensuales");
  await addColumnToMensualSheets(sheets, IDS.calendario, "PAGADO");

  console.log("\n✓ Setup completado.\n");
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.code === 403) {
    console.error("\nAsegurate de compartir cada workbook con la service account (Editor).");
  }
  process.exit(1);
});
