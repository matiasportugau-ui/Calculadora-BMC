#!/usr/bin/env node
/**
 * Backfill wa_messages → omni (B3)
 * Usage: DATABASE_URL=... npm run omni:backfill-wa [-- --dry-run] [-- --limit N]
 */
import dotenv from "dotenv";
import pg from "pg";
import { config } from "../server/config.js";
import { normalizeAndPersist } from "../server/lib/omni/normalizer.js";
import { buildIdempotencyKey } from "../server/lib/omni/types.js";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 500 : 500;

async function main() {
  const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const { rows } = await pool.query(
    `SELECT m.msg_id, m.chat_id, m.ts, m.direction, m.text, m.source,
            c.phone, c.contact_name
     FROM wa_messages m
     LEFT JOIN wa_conversations c ON c.chat_id = m.chat_id
     WHERE m.text IS NOT NULL AND m.text <> ''
     ORDER BY m.ts ASC
     LIMIT $1`,
    [limit],
  );

  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const event = {
      source: "wa_backfill",
      channel: "wa",
      idempotency_key: buildIdempotencyKey("wa", row.msg_id),
      occurred_at: new Date(row.ts).toISOString(),
      contact_hint: {
        wa_phone: row.phone || row.chat_id,
        name: row.contact_name || undefined,
      },
      conversation_hint: { channel_conversation_id: row.chat_id },
      message: {
        sender: row.direction === "out" ? "agent" : "customer",
        body: row.text,
        metadata: { wa_msg_id: row.msg_id, backfill: true, source: row.source },
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
      console.warn("backfill error", row.msg_id, e.message);
    }
  }

  await pool.end();

  const report = {
    at: new Date().toISOString(),
    dryRun,
    scanned: rows.length,
    written,
    skipped,
    errors,
  };

  const outDir = path.join(process.cwd(), ".runtime");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `omni-backfill-wa-report-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log(`report: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
