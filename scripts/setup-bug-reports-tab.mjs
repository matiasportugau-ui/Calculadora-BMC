#!/usr/bin/env node
/**
 * Creates BUG_REPORTS tab + header row on BMC_SHEET_ID (idempotent).
 * Run: node scripts/setup-bug-reports-tab.mjs
 * Requires: BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS in .env
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
/** Canonical BMC crm_automatizado — docs/google-sheets-module/planilla-inventory.md */
const DEFAULT_SHEET_ID = "1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg";
const TAB = process.env.BMC_BUG_REPORTS_TAB || "BUG_REPORTS";
const HEADERS = [
  "id",
  "timestamp",
  "shortDescription",
  "details",
  "severity",
  "url",
  "userAgent",
  "capturedAt",
  "context",
  "status",
  "source",
  "authMode",
  "screenshotUrl",
];

async function main() {
  const sheetId = process.env.BMC_SHEET_ID || DEFAULT_SHEET_ID;
  if (!process.env.BMC_SHEET_ID) {
    console.log(JSON.stringify({ ok: true, action: "sheet_id_fallback", source: "planilla-inventory canonical" }));
  }
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyPath = keyFile ? path.resolve(ROOT, keyFile) : "";
  const authOpts = { scopes: [SCOPE] };
  if (keyPath && fs.existsSync(keyPath)) {
    authOpts.keyFile = keyPath;
  } else {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log(JSON.stringify({ ok: true, action: "auth_adc", note: "using Application Default Credentials (gcloud)" }));
  }

  const auth = new google.auth.GoogleAuth(authOpts);
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === TAB);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
    });
    console.log(JSON.stringify({ ok: true, action: "tab_created", tab: TAB }));
  } else {
    console.log(JSON.stringify({ ok: true, action: "tab_exists", tab: TAB }));
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${TAB}'!A1:M1`,
  });
  const row = (headerRes.data.values || [])[0] || [];
  const needsHeaders = row.length === 0 || String(row[0] || "").toLowerCase() !== "id";

  if (needsHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${TAB}'!A1:M1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS] },
    });
    console.log(JSON.stringify({ ok: true, action: "headers_written", tab: TAB, columns: HEADERS.length }));
  } else {
    console.log(JSON.stringify({ ok: true, action: "headers_ok", tab: TAB }));
  }

  console.log(JSON.stringify({ ok: true, step: "setup_sheet", tab: TAB, sheetId }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, step: "setup_sheet", error: e.message }));
  process.exit(1);
});