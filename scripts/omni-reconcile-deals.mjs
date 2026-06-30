#!/usr/bin/env node
/**
 * Reconcile omni_deals vs CRM_Operativo Monto/Estado (WAVE 4 F3).
 * Usage: DATABASE_URL=... BMC_SHEET_ID=... npm run omni:reconcile-deals [-- --dry-run]
 */
import dotenv from "dotenv";
import pg from "pg";
import { google } from "googleapis";
import { config } from "../server/config.js";
import { getGoogleAuthClient } from "../server/lib/googleAuthCache.js";
import { stageToCrmEstado } from "../server/lib/omni/deals/stageMachine.js";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

async function loadCrmRows() {
  if (!config.bmcSheetId) return [];
  const authClient = await getGoogleAuthClient("https://www.googleapis.com/auth/spreadsheets.readonly");
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const tab = config.wolfbCrmMainTab || "CRM_Operativo";
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: config.bmcSheetId,
    range: `'${tab}'!A3:ZZ3`,
  });
  const headers = (headerRes.data.values || [[]])[0] || [];
  const idCol = headers.indexOf("ID");
  const montoCol = headers.indexOf("Monto estimado USD");
  const estadoCol = headers.indexOf("Estado");
  if (idCol === -1) return [];

  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: config.bmcSheetId,
    range: `'${tab}'!A4:ZZ`,
  });
  const rows = dataRes.data.values || [];
  return rows.map((r) => ({
    id: r[idCol],
    monto: montoCol >= 0 ? r[montoCol] : null,
    estado: estadoCol >= 0 ? r[estadoCol] : null,
  })).filter((r) => r.id);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: deals } = await pool.query(
    `SELECT id, title, value_usd, stage, properties FROM omni_deals ORDER BY updated_at DESC LIMIT 500`,
  );

  let crmRows = [];
  try {
    crmRows = await loadCrmRows();
  } catch (e) {
    console.warn("Sheets unavailable:", e.message);
  }

  const crmById = new Map(crmRows.map((r) => [String(r.id), r]));
  const drift = [];

  for (const deal of deals) {
    const crmId = deal.properties?.crm_row_id || deal.properties?.crm_id;
    if (!crmId) continue;
    const crm = crmById.get(String(crmId));
    if (!crm) {
      drift.push({ deal_id: deal.id, issue: "crm_row_missing", crm_row_id: crmId });
      continue;
    }
    const expectedEstado = stageToCrmEstado(deal.stage);
    if (crm.estado && crm.estado !== expectedEstado) {
      drift.push({
        deal_id: deal.id,
        issue: "estado_mismatch",
        omni: expectedEstado,
        sheets: crm.estado,
      });
    }
    if (deal.value_usd != null && crm.monto) {
      const sheetMonto = parseFloat(String(crm.monto).replace(",", "."));
      if (Number.isFinite(sheetMonto) && Math.abs(sheetMonto - Number(deal.value_usd)) > 0.01) {
        drift.push({
          deal_id: deal.id,
          issue: "monto_mismatch",
          omni: deal.value_usd,
          sheets: sheetMonto,
        });
      }
    }
  }

  const report = {
    at: new Date().toISOString(),
    dry_run: dryRun,
    deals_checked: deals.length,
    linked_deals: deals.filter((d) => d.properties?.crm_row_id || d.properties?.crm_id).length,
    drift_count: drift.length,
    drift: drift.slice(0, 50),
    ok: drift.length < 10,
  };

  console.log(JSON.stringify(report, null, 2));
  await pool.end();
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
