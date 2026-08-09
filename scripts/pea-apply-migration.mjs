#!/usr/bin/env node
/**
 * Apply PEA schema migrations to DATABASE_URL (local/dev only).
 * Usage: node scripts/pea-apply-migration.mjs
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migDir = path.join(__dirname, "../server/migrations/pea");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  if (files.length === 0) {
    console.error("No migrations in", migDir);
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    for (const file of files) {
      const sqlPath = path.join(migDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");
      await pool.query(sql);
      console.log("OK: applied", sqlPath);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
