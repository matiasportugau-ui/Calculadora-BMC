#!/usr/bin/env node
/**
 * WA Cockpit — Reconciliador nocturno (F4)
 *
 * Cruza `wa_quotes.link` (Postgres) contra la columna AH (LINK_PRESUPUESTO) del
 * Sheet CRM_Operativo y reporta drift. Si hay match en wa_conversations.lead_sheet_row
 * pero el link de la fila de la Sheet difiere del último wa_quotes.link → drift.
 *
 * Output: reporte JSON por stdout y resumen a `.runtime/wa-reconcile-<date>.json`.
 * Exit code 0 siempre (informativo); el magazine diario lo levanta si hay drift > 0.
 *
 * Uso: DATABASE_URL=... GOOGLE_APPLICATION_CREDENTIALS=... node scripts/wa-reconcile-sheet.mjs
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { google } from "googleapis";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const SHEET_ID = process.env.BMC_SHEET_ID;
const CRM_TAB = process.env.WOLFB_CRM_MAIN_TAB || "CRM_Operativo";
const FIRST_DATA_ROW = 5;

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  if (!SHEET_ID) {
    console.error("BMC_SHEET_ID required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const startedAt = new Date().toISOString();

  // Última cotización por chat (donde lead_sheet_row != null)
  const { rows: candidates } = await pool.query(
    `with last_q as (
       select chat_id, link, total_usd, generated_at,
              row_number() over (partition by chat_id order by generated_at desc) as rn
       from wa_quotes
       where link is not null
     )
     select c.chat_id, c.lead_sheet_row, c.contact_name, c.phone,
            q.link as wa_link, q.total_usd, q.generated_at
     from wa_conversations c
     join last_q q on q.chat_id = c.chat_id and q.rn = 1
     where c.lead_sheet_row is not null`,
  );

  await pool.end();

  if (candidates.length === 0) {
    const out = {
      ok: true,
      checked: 0,
      drift: 0,
      mismatches: [],
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    };
    persistReport(out);
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  // Trae col AH de la pestaña CRM
  const range = `'${CRM_TAB}'!AH${FIRST_DATA_ROW}:AH1000`;
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
  const ahValues = r.data.values || [];
  const sheetAhByRow = new Map();
  ahValues.forEach((row, i) => {
    const v = (row?.[0] || "").trim();
    if (v) sheetAhByRow.set(FIRST_DATA_ROW + i, v);
  });

  const mismatches = [];
  let drift = 0;
  for (const c of candidates) {
    const sheetLink = sheetAhByRow.get(c.lead_sheet_row) || "";
    const waLink = c.wa_link || "";
    if (!sheetLink) {
      mismatches.push({
        chat_id: c.chat_id,
        lead_sheet_row: c.lead_sheet_row,
        kind: "sheet_missing",
        wa_link: waLink,
        sheet_link: null,
      });
      drift += 1;
      continue;
    }
    if (sheetLink !== waLink) {
      mismatches.push({
        chat_id: c.chat_id,
        lead_sheet_row: c.lead_sheet_row,
        kind: "diff",
        wa_link: waLink,
        sheet_link: sheetLink,
      });
      drift += 1;
    }
  }

  const out = {
    ok: drift === 0,
    checked: candidates.length,
    drift,
    mismatches,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  };
  persistReport(out);
  console.log(JSON.stringify(out, null, 2));
}

function persistReport(out) {
  try {
    const dir = path.resolve(".runtime");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `wa-reconcile-${date}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 2));
  } catch {
    // best-effort
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
