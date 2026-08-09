#!/usr/bin/env node
/**
 * Aplica migraciones SQL en orden desde workspace-package/migrations/.
 * Uso: DATABASE_URL=postgres://... npm run workspace:migrate
 * Idempotent via panelin_workspace.schema_migrations.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "workspace-package", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS panelin_workspace`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS panelin_workspace.schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM panelin_workspace.schema_migrations WHERE name = $1",
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
          "INSERT INTO panelin_workspace.schema_migrations (name) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`apply ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("workspace migrations up to date");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
