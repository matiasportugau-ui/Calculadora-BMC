#!/usr/bin/env node
/**
 * Enhanced Omni Core Postgres migrations with rollback support.
 * Features:
 *   - Track migration status (applied/rolled_back)
 *   - Support down migrations (*.down.sql)
 *   - Pre-migration validation (integrity checks)
 *   - Rollback capability
 *
 * Usage:
 *   npm run omni:migrate              # Apply pending migrations
 *   npm run omni:migrate -- --rollback <count>  # Rollback last N migrations
 *   npm run omni:migrate -- --status  # Show migration status
 *
 * Migration files:
 *   - Forward:  001_feature.sql
 *   - Rollback: 001_feature.down.sql (optional, must be paired)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "server", "migrations", "omni");

const MIGRATIONS_TABLE = "omni_schema_migrations";
const STATUS_APPLIED = "applied";
const STATUS_ROLLED_BACK = "rolled_back";

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    rollback: args.includes("--rollback"),
    rollbackCount: parseInt(args[args.indexOf("--rollback") + 1] || "1", 10),
    status: args.includes("--status"),
    force: args.includes("--force"),
  };
}

/**
 * Ensure migrations table exists with rollback support
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT '${STATUS_APPLIED}' CHECK (status IN ('${STATUS_APPLIED}', '${STATUS_ROLLED_BACK}')),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      rolled_back_at TIMESTAMPTZ,
      batch_number INT,
      has_down_migration BOOLEAN DEFAULT false,
      checksum TEXT,
      CONSTRAINT valid_rollback_date CHECK (
        (status = '${STATUS_ROLLED_BACK}' AND rolled_back_at IS NOT NULL) OR
        (status = '${STATUS_APPLIED}' AND rolled_back_at IS NULL)
      )
    );
    
    CREATE INDEX IF NOT EXISTS idx_migrations_status ON ${MIGRATIONS_TABLE}(status);
    CREATE INDEX IF NOT EXISTS idx_migrations_batch ON ${MIGRATIONS_TABLE}(batch_number);
  `);
}

/**
 * Calculate file checksum for integrity verification
 */
function calculateChecksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Get all migration files paired with their down migrations
 */
function getMigrationPairs() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.includes(".down."))
    .sort();

  return files.map((file) => {
    const downFile = file.replace(/\.sql$/, ".down.sql");
    const hasDownMigration = fs.existsSync(
      path.join(migrationsDir, downFile)
    );
    return { upFile: file, downFile, hasDownMigration };
  });
}

/**
 * Show migration status
 */
async function showStatus(client) {
  const result = await client.query(`
    SELECT 
      id,
      name,
      status,
      applied_at,
      rolled_back_at,
      batch_number,
      has_down_migration
    FROM ${MIGRATIONS_TABLE}
    ORDER BY id DESC
    LIMIT 20
  `);

  console.log("\n📋 Migration Status (last 20):");
  console.log("─".repeat(80));
  if (result.rows.length === 0) {
    console.log("No migrations applied yet.");
    return;
  }

  result.rows.forEach((row) => {
    const icon = row.status === STATUS_APPLIED ? "✅" : "↩️";
    const timestamp = row.status === STATUS_APPLIED 
      ? new Date(row.applied_at).toISOString().split("T")[0]
      : new Date(row.rolled_back_at).toISOString().split("T")[0];
    const downMarker = row.has_down_migration ? "🔄" : "❌";
    console.log(
      `${icon} ${row.name.padEnd(40)} [${row.status.padEnd(11)}] ${downMarker} ${timestamp}`
    );
  });
  console.log("─".repeat(80));
  console.log(
    `Legend: ✅ = applied, ↩️ = rolled_back, 🔄 = has down migration, ❌ = no down migration`
  );
}

/**
 * Apply pending migrations
 */
async function applyMigrations(client) {
  const pairs = getMigrationPairs();
  
  await ensureMigrationsTable(client);

  const appliedRows = await client.query(
    `SELECT name FROM ${MIGRATIONS_TABLE} WHERE status = $1 ORDER BY id DESC LIMIT 1`,
    [STATUS_APPLIED]
  );
  const lastAppliedId = appliedRows.rows[0]
    ? parseInt(appliedRows.rows[0].name.split("_")[0], 10)
    : 0;

  const batch = await client.query(
    `SELECT COALESCE(MAX(batch_number), 0) + 1 as next_batch FROM ${MIGRATIONS_TABLE}`
  );
  const batchNumber = batch.rows[0].next_batch;

  let applied = 0;
  for (const { upFile, downFile, hasDownMigration } of pairs) {
    const fileId = parseInt(upFile.split("_")[0], 10);
    if (fileId <= lastAppliedId) continue; // Already applied

    const upPath = path.join(migrationsDir, upFile);
    const downPath = path.join(migrationsDir, downFile);

    // Pre-migration validation
    console.log(`\n📝 Validating ${upFile}...`);
    const upContent = fs.readFileSync(upPath, "utf8");
    if (!upContent.trim()) {
      console.warn(`⚠️  WARNING: ${upFile} is empty, skipping`);
      continue;
    }

    // Check for common patterns that might indicate data loss
    if (
      upContent.includes("DROP TABLE") &&
      !upContent.includes("IF EXISTS")
    ) {
      console.error(
        `❌ ERROR: ${upFile} contains unsafe DROP TABLE (missing IF EXISTS)`
      );
      if (!process.argv.includes("--force")) {
        console.error(
          "   Use --force to override. This is a data loss risk!"
        );
        process.exit(1);
      }
    }

    if (
      upContent.includes("TRUNCATE") ||
      (upContent.includes("DELETE FROM") && !upContent.includes("WHERE"))
    ) {
      console.warn(
        `⚠️  WARNING: ${upFile} performs bulk delete/truncate (potential data loss)`
      );
      if (!process.argv.includes("--force")) {
        console.error("   Use --force to override.");
        process.exit(1);
      }
    }

    // Execute migration
    console.log(`🚀 Applying ${upFile}...`);
    await client.query("BEGIN");
    try {
      // Pre-migration data snapshot for debugging
      const tableCountsBefore = await client.query(`
        SELECT schemaname, tablename, n_live_tup as row_count 
        FROM pg_stat_user_tables 
        ORDER BY tablename
      `);

      // Apply migration
      await client.query(upContent);

      // Post-migration validation
      const tableCountsAfter = await client.query(`
        SELECT schemaname, tablename, n_live_tup as row_count 
        FROM pg_stat_user_tables 
        ORDER BY tablename
      `);

      // Log significant changes
      const changes = tableCountsAfter.rows.filter((row) => {
        const before = tableCountsBefore.rows.find(
          (r) => r.tablename === row.tablename
        );
        if (!before) {
          console.log(
            `   ℹ️  New table created: ${row.tablename} (${row.row_count} rows)`
          );
          return true;
        }
        const delta = row.row_count - before.row_count;
        if (Math.abs(delta) > 100) {
          console.log(
            `   ℹ️  ${row.tablename}: ${delta > 0 ? "+" : ""}${delta} rows`
          );
        }
        return false;
      });

      // Record in migrations table
      const checksum = calculateChecksum(upContent);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name, status, batch_number, has_down_migration, checksum)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET status = $2, batch_number = $3`,
        [
          upFile,
          STATUS_APPLIED,
          batchNumber,
          hasDownMigration,
          checksum,
        ]
      );

      await client.query("COMMIT");
      console.log(`✅ ${upFile} applied successfully`);
      applied++;
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`❌ ERROR applying ${upFile}:`);
      console.error(e.message);
      throw e;
    }
  }

  if (applied === 0) {
    console.log("\n✅ All migrations are up to date");
  } else {
    console.log(`\n✅ Applied ${applied} migration(s)`);
  }
}

/**
 * Rollback migrations
 */
async function rollbackMigrations(client, count) {
  await ensureMigrationsTable(client);

  const toRollback = await client.query(
    `SELECT id, name, has_down_migration FROM ${MIGRATIONS_TABLE} 
     WHERE status = $1 
     ORDER BY id DESC 
     LIMIT $2`,
    [STATUS_APPLIED, count]
  );

  if (toRollback.rows.length === 0) {
    console.log("ℹ️  No migrations to rollback");
    return;
  }

  console.log(`\n⏮️  Rolling back ${toRollback.rows.length} migration(s):`);

  for (const row of toRollback.rows) {
    if (!row.has_down_migration) {
      console.error(
        `❌ Cannot rollback ${row.name}: no ${row.name.replace(/\.sql$/, ".down.sql")} file found`
      );
      process.exit(1);
    }

    const downFile = row.name.replace(/\.sql$/, ".down.sql");
    const downPath = path.join(migrationsDir, downFile);

    console.log(`🔄 Rolling back ${row.name}...`);
    const downContent = fs.readFileSync(downPath, "utf8");

    await client.query("BEGIN");
    try {
      await client.query(downContent);
      await client.query(
        `UPDATE ${MIGRATIONS_TABLE} 
         SET status = $1, rolled_back_at = now() 
         WHERE name = $2`,
        [STATUS_ROLLED_BACK, row.name]
      );
      await client.query("COMMIT");
      console.log(`✅ ${row.name} rolled back`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`❌ ERROR rolling back ${row.name}:`);
      console.error(e.message);
      throw e;
    }
  }

  console.log(`\n✅ Rolled back ${toRollback.rows.length} migration(s)`);
}

/**
 * Main
 */
async function main() {
  const { rollback, rollbackCount, status, force } = parseArgs();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is required");
    process.exit(1);
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    if (status) {
      await showStatus(client);
    } else if (rollback) {
      await rollbackMigrations(client, rollbackCount);
    } else {
      await applyMigrations(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
