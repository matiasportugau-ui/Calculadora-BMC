#!/usr/bin/env node
/**
 * Channel reconcile report — WAVE 3 M4.
 * Usage: npm run omni:reconcile-channels [-- --dry-run]
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const report = { ok: true, dryRun, at: new Date().toISOString(), channels: {} };

  try {
    for (const channel of ["wa", "ml", "email"]) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS conversations FROM omni_conversations WHERE channel = $1`,
        [channel],
      );
      const { rows: msgRows } = await pool.query(
        `SELECT COUNT(*)::int AS messages
         FROM omni_messages m
         JOIN omni_conversations c ON c.id = m.conversation_id
         WHERE c.channel = $1`,
        [channel],
      );
      report.channels[channel] = {
        omni_conversations: rows[0]?.conversations ?? 0,
        omni_messages: msgRows[0]?.messages ?? 0,
      };
    }

    const outDir = path.join(process.cwd(), ".runtime");
    if (!dryRun) {
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `omni-reconcile-channels-${Date.now()}.json`);
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(`wrote ${outPath}`);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
