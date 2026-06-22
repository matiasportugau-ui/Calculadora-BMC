#!/usr/bin/env node
/**
 * Backfill CRM ML rows → omni (C2) — reads Sheets when creds available.
 * Usage: npm run omni:backfill-ml-crm [-- --dry-run] [-- --limit N]
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { config } from "../server/config.js";
import { normalizeAndPersist } from "../server/lib/omni/normalizer.js";
import { buildIdempotencyKey } from "../server/lib/omni/types.js";
import { extractMlQuestionId } from "../server/lib/crmRowParse.js";

dotenv.config();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 200 : 200;

async function getSheets() {
  const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  const auth = new google.auth.GoogleAuth({
    ...(credsPath ? { keyFile: credsPath } : {}),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

async function main() {
  const sheetId = config.bmcSheetId;
  if (!sheetId) {
    console.error("BMC_SHEET_ID required");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;
  if (!databaseUrl && !dryRun) {
    console.error("DATABASE_URL required unless --dry-run");
    process.exit(1);
  }

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'CRM_Operativo'!A4:AK2000",
  });
  const rows = res.data.values || [];

  let scanned = 0;
  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length && scanned < limit; i++) {
    const row = rows[i];
    const origen = String(row[4] || "");
    if (!/ML/i.test(origen)) continue;
    scanned += 1;

    const obs = String(row[20] || "");
    const qid = extractMlQuestionId(obs);
    if (!qid) continue;

    const nickname = String(row[1] || "");
    const consulta = String(row[5] || "");
    if (!consulta.trim()) continue;

    const event = {
      source: "ml_backfill",
      channel: "ml",
      idempotency_key: buildIdempotencyKey("ml", qid),
      occurred_at: new Date().toISOString(),
      contact_hint: { name: nickname },
      conversation_hint: {
        channel_conversation_id: qid,
        subject: obs.slice(0, 512),
      },
      message: {
        sender: "customer",
        body: consulta,
        metadata: { ml_question_id: qid, backfill: true, crm_row: i + 4 },
      },
    };

    if (dryRun) {
      skipped += 1;
      continue;
    }

    try {
      const r = await normalizeAndPersist(event, { databaseUrl });
      if (r?.duplicate) skipped += 1;
      else written += 1;
    } catch (e) {
      errors += 1;
      console.warn("backfill ml error", qid, e.message);
    }
  }

  const report = { at: new Date().toISOString(), dryRun, scanned, written, skipped, errors };
  const outDir = path.join(process.cwd(), ".runtime");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `omni-backfill-ml-report-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log(`report: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
