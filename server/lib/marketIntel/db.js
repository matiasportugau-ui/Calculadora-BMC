// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
//
// Shared Postgres access + provisioning-error classification for the Market
// Intelligence read path (dashboard routes + mystery-shopping queue). Centralised
// here so the "not provisioned" contract — and the single pool — live in exactly
// one place instead of being copy-pasted (and silently drifting) per module.

import pg from 'pg';

// Stable code we attach when DATABASE_URL is absent, so callers classify it the
// same way they classify a missing schema/relation WITHOUT matching on a brittle
// error-message string.
export const NO_DATABASE_URL = 'NO_DATABASE_URL';

// PostgreSQL SQLSTATE codes that mean "the bmc_market_intel schema/relations are
// not provisioned yet" (migrations not applied) rather than a transient outage:
//   42P01 undefined_table · 42703 undefined_column
//   3F000 invalid_schema_name · 3D000 invalid_catalog_name
const NOT_PROVISIONED_PG_CODES = new Set(['42P01', '42703', '3F000', '3D000']);

let _pool = null;

export function pool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      const err = new Error('DATABASE_URL required');
      err.code = NO_DATABASE_URL;
      throw err;
    }
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

// A persistent 503 turns the dashboard into a dead-end ("Reintentar" can never
// succeed). When the cause is simply that the module isn't wired up yet — no
// DATABASE_URL, or migrations not run — callers degrade to an empty 200 payload
// instead, matching the project convention "200 + empty payload = no data".
// Genuine outages (ECONNREFUSED, timeouts, etc.) are deliberately NOT matched,
// so they keep returning 503 where retrying is meaningful.
export function isNotProvisioned(err) {
  return err?.code === NO_DATABASE_URL || NOT_PROVISIONED_PG_CODES.has(err?.code);
}
