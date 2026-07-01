#!/usr/bin/env node
/**
 * Apply Omni Core Postgres migrations (server/migrations/omni/*.sql).
 * Usage: DATABASE_URL=postgres://... npm run omni:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "server", "migrations", "omni");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error(`migrations dir not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("no omni migrations found");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS omni_schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM omni_schema_migrations WHERE name = $1",
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
        await client.query(
          "INSERT INTO omni_schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
          [file],
        );
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
  console.log("omni migrations done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
