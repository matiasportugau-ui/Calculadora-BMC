#!/usr/bin/env node
/**
 * Warn/fail when identity.user_drive_config is missing from DATABASE_URL.
 * Used by pre-deploy when DATABASE_URL is available (local .env or Doppler).
 *
 * Exit 0 — table present, or DATABASE_URL unset (skip).
 * Exit 1 — table missing (Drive folder config POST returns 503 in prod).
 * Exit 2 — connectivity/query error (not a missing-table signal).
 */
import pg from "pg";

const url = process.env.DATABASE_URL || "";
if (!url) {
  console.log("[drive-config-table] DATABASE_URL unset — skip");
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 8000,
  max: 1,
});

try {
  const { rows } = await pool.query(
    `select count(*)::int as n
       from pg_tables
      where schemaname = 'identity'
        and tablename = 'user_drive_config'`,
  );
  const n = rows[0]?.n ?? 0;
  if (n > 0) {
    console.log("[drive-config-table] OK — identity.user_drive_config exists");
    process.exit(0);
  }
  console.error(
    "[drive-config-table] MISSING — run: npm run identity:golive:apply\n" +
      "  (or: psql \"$DATABASE_URL\" -f supabase/migrations/20260624000001_user_drive_config.sql)",
  );
  process.exit(1);
} catch (e) {
  console.error("[drive-config-table] check failed:", e?.message || e);
  process.exit(2);
} finally {
  await pool.end().catch(() => {});
}
