#!/usr/bin/env node
/**
 * Aplica migraciones SQL del schema bmc_catalog en orden desde supabase/migrations/.
 * Solo toma archivos cuyo nombre contiene "bmc_catalog" y no "rollback".
 * Uso: DATABASE_URL=postgres://... npm run catalog:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f.includes("bmc_catalog") && !f.includes("rollback"))
    .sort();

  if (files.length === 0) {
    console.log("no bmc_catalog migrations found");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists catalog_schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query(
        "select 1 from catalog_schema_migrations where name = $1",
        [file],
      );
      if (rows.length > 0) {
        console.log(`skip ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("insert into catalog_schema_migrations (name) values ($1)", [file]);
        await client.query("COMMIT");
        console.log(`ok  ${file}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log("bmc_catalog migrations done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
