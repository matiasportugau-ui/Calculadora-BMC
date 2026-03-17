#!/usr/bin/env node
/**
 * BMC Dashboard — Verify Sheets Tabs via API
 * Uses service account to list tabs in the workbook.
 * Run: node scripts/verify-sheets-tabs.js
 * Requires: .env with BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(REPO, ".env") });

const SHEET_ID = process.env.BMC_SHEET_ID;
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(REPO, process.env.GOOGLE_APPLICATION_CREDENTIALS.replace(/^["']|["']$/g, ""))
  : path.join(REPO, "docs/bmc-dashboard-modernization/service-account.json");

const REQUIRED_TABS = [
  "CRM_Operativo",
  "Pagos_Pendientes",
  "Metas_Ventas",
  "AUDIT_LOG",
  "Master_Cotizaciones",
  "Ventas realizadas y entregadas",
];

async function main() {
  console.log("\nBMC Sheets Tabs Verifier\n");

  if (!SHEET_ID) {
    console.error("  ✗ BMC_SHEET_ID not set in .env");
    process.exit(1);
  }

  if (!fs.existsSync(CREDS_PATH)) {
    console.error("  ✗ Service account JSON not found:", CREDS_PATH);
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const tabs = (res.data.sheets || []).map((s) => s.properties?.title || "").filter(Boolean);

    console.log("  Workbook:", res.data.properties?.title || SHEET_ID);
    console.log("  Tabs found:", tabs.length);
    console.log("");

    const missing = REQUIRED_TABS.filter((t) => !tabs.includes(t));
    const found = REQUIRED_TABS.filter((t) => tabs.includes(t));

    for (const t of found) {
      console.log("  ✓", t);
    }
    for (const t of missing) {
      console.log("  ✗", t, "(missing)");
    }

    if (missing.length > 0) {
      console.log("\n  → Run runInitialSetup() in Apps Script to create missing tabs.");
      console.log("  → Or share workbook with service account and run: docs/bmc-dashboard-modernization/Code.gs\n");
      process.exit(1);
    }

    console.log("\n  All required tabs present.\n");
  } catch (err) {
    if (err.code === 403 || err.message?.includes("permission")) {
      console.error("  ✗ Permission denied. Share the workbook with the service account email as Editor.");
      console.error("  → Service account email:", creds?.client_email || "(see service-account.json)");
      console.error("  → In Google Sheets: Share → Add people →", email, "→ Editor\n");
    } else {
      console.error("  ✗", err.message || err);
    }
    process.exit(1);
  }
}

main();
