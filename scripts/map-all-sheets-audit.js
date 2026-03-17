#!/usr/bin/env node
/**
 * Full Sheets Audit — Tab-by-tab, column-by-column mapping.
 * READ-ONLY: inspects all BMC workbooks without editing.
 * Output: JSON + Markdown report.
 *
 * Run: node scripts/map-all-sheets-audit.js
 * Requires: GOOGLE_APPLICATION_CREDENTIALS, BMC_*_SHEET_ID in .env
 */
import { config as loadEnv } from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const SCOPE_READ = "https://www.googleapis.com/auth/spreadsheets.readonly";

const WORKBOOKS = [
  { id: process.env.BMC_SHEET_ID, name: "BMC crm_automatizado", env: "BMC_SHEET_ID" },
  { id: process.env.BMC_PAGOS_SHEET_ID, name: "Pagos Pendientes 2026", env: "BMC_PAGOS_SHEET_ID" },
  { id: process.env.BMC_VENTAS_SHEET_ID, name: "2.0 - Ventas", env: "BMC_VENTAS_SHEET_ID" },
  { id: process.env.BMC_STOCK_SHEET_ID, name: "Stock E-Commerce", env: "BMC_STOCK_SHEET_ID" },
  { id: process.env.BMC_CALENDARIO_SHEET_ID, name: "Calendario de vencimientos", env: "BMC_CALENDARIO_SHEET_ID" },
].filter((w) => w.id);

async function getSheetNames(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets || []).map((s) => ({
    title: s.properties?.title || "Hoja sin nombre",
    sheetId: s.properties?.sheetId,
    rowCount: s.properties?.gridProperties?.rowCount || 0,
    colCount: s.properties?.gridProperties?.columnCount || 0,
  }));
}

async function getSheetValues(sheets, spreadsheetId, sheetTitle, maxRows = 30) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:ZZ${maxRows}`,
    });
    return res.data.values || [];
  } catch (e) {
    throw new Error(e.message);
  }
}

function inferColumnType(samples) {
  const nonEmpty = samples.filter((v) => v != null && String(v).trim() !== "");
  if (nonEmpty.length === 0) return "string";
  const nums = nonEmpty.filter((v) => !isNaN(parseFloat(String(v).replace(/[.,]/g, (m) => (m === "," ? "." : "")))));
  if (nums.length / nonEmpty.length > 0.8) return "number";
  const dates = nonEmpty.filter((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && /^\d{1,4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(String(v));
  });
  if (dates.length / nonEmpty.length > 0.5) return "date";
  return "string";
}

async function mapWorkbook(authClient, wb) {
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const tabs = await getSheetNames(sheets, wb.id);
  const result = {
    workbookId: wb.id,
    workbookName: wb.name,
    envVar: wb.env,
    tabCount: tabs.length,
    tabs: [],
  };

  for (const tab of tabs) {
    let values;
    try {
      values = await getSheetValues(sheets, wb.id, tab.title);
    } catch (e) {
      result.tabs.push({
        title: tab.title,
        sheetId: tab.sheetId,
        rowCount: tab.rowCount,
        colCount: tab.colCount,
        error: e.message,
        columns: [],
        sampleRows: 0,
      });
      continue;
    }

    const headers = values[0] || [];
    const dataRows = values.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
    const columns = headers.map((h, i) => {
      const samples = dataRows.slice(0, 20).map((r) => r[i]);
      return {
        index: i + 1,
        letter: i < 26 ? String.fromCharCode(65 + i) : `col${i + 1}`,
        header: h || `(col ${i + 1})`,
        sampleValues: samples.slice(0, 5).filter(Boolean),
        inferredType: inferColumnType(samples),
        nonEmptyCount: samples.filter((v) => v != null && String(v).trim() !== "").length,
      };
    });

    result.tabs.push({
      title: tab.title,
      sheetId: tab.sheetId,
      rowCount: tab.rowCount,
      colCount: tab.colCount,
      dataRowCount: dataRows.length,
      columnCount: headers.filter(Boolean).length,
      columns,
      sampleRows: Math.min(5, dataRows.length),
      sampleData: dataRows.slice(0, 5).map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h || `col${i}`] = row[i] ?? ""));
        return obj;
      }),
    });
  }

  return result;
}

async function main() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_READ] });
  const authClient = await auth.getClient();

  const report = {
    generatedAt: new Date().toISOString(),
    workbooksConfigured: WORKBOOKS.length,
    workbooks: [],
  };

  const outDir = path.resolve(process.cwd(), "docs/google-sheets-module");
  fs.mkdirSync(outDir, { recursive: true });

  for (const wb of WORKBOOKS) {
    try {
      const mapped = await mapWorkbook(authClient, wb);
      report.workbooks.push(mapped);
      console.error(`✓ ${wb.name}: ${mapped.tabCount} tabs`);
      fs.writeFileSync(
        path.join(outDir, "FULL-SHEETS-AUDIT-RAW.json"),
        JSON.stringify(report, null, 2),
        "utf8"
      );
    } catch (e) {
      console.error(`✗ ${wb.name}: ${e.message}`);
      report.workbooks.push({
        workbookId: wb.id,
        workbookName: wb.name,
        envVar: wb.env,
        error: e.message,
        tabs: [],
      });
      fs.writeFileSync(
        path.join(outDir, "FULL-SHEETS-AUDIT-RAW.json"),
        JSON.stringify(report, null, 2),
        "utf8"
      );
    }
  }

  const jsonPath = path.join(outDir, "FULL-SHEETS-AUDIT-RAW.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  console.error(`\nRaw JSON: ${jsonPath}`);

  return report;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
