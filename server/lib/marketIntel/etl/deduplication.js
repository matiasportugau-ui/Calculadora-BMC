// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import pg from 'pg';

let _pool = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
};

/**
 * Normalize a domain string: lowercase, strip protocol, strip www., strip path.
 *
 * @param {string} raw - e.g. "https://www.Example.COM/path"
 * @returns {string}   - e.g. "example.com"
 */
export function normalizeDomain(raw) {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

/**
 * Upsert a competitor by normalized domain.
 * If a competitor with the same domain exists → update name/url/notes.
 * Otherwise → insert new record.
 *
 * @param {{ name: string, domain: string, website_url: string, notes?: string }} input
 * @returns {Promise<object>} - The upserted competitor row
 */
export async function upsertCompetitor(input) {
  const domain = normalizeDomain(input.domain);

  const { rows } = await pool().query(
    `INSERT INTO bmc_market_intel.competitors
       (name, domain, website_url, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (domain) DO UPDATE
       SET name        = EXCLUDED.name,
           website_url = EXCLUDED.website_url,
           notes       = EXCLUDED.notes,
           updated_at  = NOW()
     RETURNING *`,
    [input.name, domain, input.website_url, input.notes ?? null]
  );

  return rows[0];
}
