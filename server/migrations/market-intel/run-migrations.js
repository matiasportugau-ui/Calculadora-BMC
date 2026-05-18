// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Idempotent migration runner for bmc_market_intel schema.
// Usage: node server/migrations/market-intel/run-migrations.js

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  log.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT filename FROM public.schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) {
        log.debug({ file }, 'already applied — skipping');
        continue;
      }

      const sql = readFileSync(join(__dirname, file), 'utf8');
      log.info({ file }, 'applying migration');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        log.info({ file }, 'migration applied');
      } catch (err) {
        await client.query('ROLLBACK');
        log.error({ err, file }, 'migration failed — rolled back');
        throw err;
      }
    }

    log.info('all market-intel migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  log.error({ err }, 'migration runner crashed');
  process.exit(1);
});
