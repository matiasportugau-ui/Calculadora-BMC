#!/usr/bin/env node
/**
 * WA Cockpit — Purge TTL (F5)
 *
 * Borra el cuerpo (`text`, `raw`) de wa_messages anteriores a WA_TTL_DAYS días
 * (default 180), manteniendo metadata (msg_id, ts, chat_id, direction, type, source,
 * status, meta sin texto). Reduce huella de datos sensibles a la vez que conserva
 * series temporales para métricas.
 *
 * Uso:
 *   DATABASE_URL=... npm run wa:purge-old
 *   DATABASE_URL=... WA_TTL_DAYS=120 node scripts/wa-purge-old.mjs --dry-run
 */
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function main() {
  const argv = new Set(process.argv.slice(2));
  const dryRun = argv.has("--dry-run");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const ttlDays = Math.max(7, Number(process.env.WA_TTL_DAYS || 180));

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const { rows: countRows } = await pool.query(
      `select count(*)::int as n
       from wa_messages
       where ts < now() - ($1 || ' days')::interval
         and text is not null`,
      [String(ttlDays)],
    );
    const candidates = countRows?.[0]?.n ?? 0;
    console.log(JSON.stringify({ ttl_days: ttlDays, candidates, dry_run: dryRun }, null, 2));

    if (dryRun || candidates === 0) {
      return;
    }

    const r = await pool.query(
      `update wa_messages
          set text = null,
              raw = '{}'::jsonb,
              meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('purged_at', now()::text)
        where ts < now() - ($1 || ' days')::interval
          and text is not null`,
      [String(ttlDays)],
    );
    console.log(JSON.stringify({ purged_rows: r.rowCount }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
