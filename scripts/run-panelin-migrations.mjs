#!/usr/bin/env node
/**
 * Aplica migraciones SQL del Panelin BMC Platform (PostgreSQL central).
 * Patrón idéntico a wa:migrate y transportista:migrate para consistencia.
 *
 * Uso:
 *   npm run panelin:migrate
 *   # o con Doppler (recomendado en local):
 *   doppler run -- npm run panelin:migrate
 *
 * Requiere: DATABASE_URL en el entorno (inyectado por Doppler o .env)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "panelin-platform", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (use doppler run -- or export it)");
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
    console.log("no panelin migrations found");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    // Tracking table (prefixed to avoid collision with other modules)
    await client.query(`
      create table if not exists panelin_schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    console.log(`Panelin migrations dir: ${migrationsDir}`);
    console.log(`Found ${files.length} migration file(s).`);

    for (const file of files) {
      const { rows } = await client.query(
        "select 1 from panelin_schema_migrations where name = $1",
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
          "insert into panelin_schema_migrations (name) values ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`ok  ${file}`);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`FAILED ${file}`);
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("panelin migrations done ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
