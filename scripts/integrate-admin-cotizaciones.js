/**
 * Integra el contenido de "2.0 - Administrador de Cotizaciones" en "BMC crm_automatizado".
 * Crea la tab Admin_Cotizaciones en el destino y copia cabecera + datos desde la hoja Admin. del origen.
 *
 * Uso: npm run integrate-admin-cotizaciones
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS (o auth por defecto). Compartir ambos workbooks con la service account.
 */
import "dotenv/config";
import { google } from "googleapis";

const SCOPE_READ = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

const SOURCE_ID = process.env.BMC_ADMIN_COTIZACIONES_SOURCE_ID || "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0";
const TARGET_ID = process.env.BMC_SHEET_ID || "1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg";
const SOURCE_SHEET_NAME = process.env.BMC_ADMIN_SOURCE_SHEET || "Admin.";
const TARGET_SHEET_NAME = "Admin_Cotizaciones";

// Fila 2 en el origen = cabecera; datos desde fila 3
const HEADER_ROW_ORIGIN = 2;
const DATA_START_ROW_ORIGIN = 3;

function isSectionHeaderRow(row) {
  if (!Array.isArray(row) || row.length === 0) return true;
  const first = String(row[0] || "").trim().toUpperCase();
  const second = String(row[1] || "").trim().toUpperCase();
  if (first === "ESPERANDO RESPUESTAS DE LOS CLIENTES" || second === "2024") return true;
  if (first === "ENVIADOS" || first === "CONFIRMADO") return true;
  return false;
}

function isEmptyRow(row) {
  if (!Array.isArray(row)) return true;
  return row.every((c) => c === undefined || c === null || String(c).trim() === "");
}

async function getAuth() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_READ, SCOPE_WRITE] });
  return auth.getClient();
}

async function getSheetNames(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);
}

async function readSourceData(sheets, sheetName = SOURCE_SHEET_NAME) {
  const range = `'${sheetName}'!A${HEADER_ROW_ORIGIN}:ZZ`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_ID,
    range,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return { headers: [], dataRows: [] };
  const headers = rows[0];
  const dataRows = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;
    if (isSectionHeaderRow(row)) continue;
    dataRows.push(row);
  }
  return { headers, dataRows };
}

async function ensureTargetSheet(sheets) {
  const titles = await getSheetNames(sheets, TARGET_ID);
  if (titles.includes(TARGET_SHEET_NAME)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: TARGET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: TARGET_SHEET_NAME },
          },
        },
      ],
    },
  });
}

async function writeTargetData(sheets, headers, dataRows) {
  const grid = [headers, ...dataRows];
  const numCols = Math.max(headers.length, ...dataRows.map((r) => r.length));
  const range = `'${TARGET_SHEET_NAME}'!A1:${columnLetter(numCols)}${grid.length}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: TARGET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: grid },
  });
}

function columnLetter(n) {
  let s = "";
  let k = n;
  while (k > 0) {
    const r = (k - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    k = Math.floor((k - 1) / 26);
  }
  return s || "A";
}

async function run() {
  console.log("Integración Admin Cotizaciones → BMC crm_automatizado");
  console.log("Origen:", SOURCE_ID, "hoja:", SOURCE_SHEET_NAME);
  console.log("Destino:", TARGET_ID, "tab:", TARGET_SHEET_NAME);

  const auth = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const sourceSheets = await getSheetNames(sheets, SOURCE_ID);
  let sourceSheetName = SOURCE_SHEET_NAME;
  if (!sourceSheets.some((t) => t.toLowerCase() === SOURCE_SHEET_NAME.toLowerCase())) {
    console.warn("Hoja origen no encontrada:", SOURCE_SHEET_NAME, "Disponibles:", sourceSheets.join(", "));
    const first = sourceSheets[0];
    if (first) {
      sourceSheetName = first;
      console.log("Usando primera hoja:", first);
    }
  }

  const { headers, dataRows } = await readSourceData(sheets, sourceSheetName);
  console.log("Filas leídas (cabecera + datos):", 1 + dataRows.length, "| Columnas:", headers.length);

  await ensureTargetSheet(sheets);
  await writeTargetData(sheets, headers, dataRows);
  console.log("Escritura completada en", TARGET_SHEET_NAME);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
