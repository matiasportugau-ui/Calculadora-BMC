// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import pg from 'pg';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

let _pool = null;
const pool = () => (_pool ??= getPool());

/**
 * Return the last recorded price for a competitor+SKU pair.
 * Returns null if no previous record exists.
 *
 * @param {string} competitorId
 * @param {string} skuId
 * @returns {Promise<number|null>}
 */
export async function getLastPrice(competitorId, skuId) {
  const { rows } = await pool().query(
    `SELECT price
     FROM bmc_market_intel.price_history
     WHERE competitor_id = $1 AND sku_id = $2
     ORDER BY scraped_at DESC
     LIMIT 1`,
    [competitorId, skuId]
  );
  return rows.length ? parseFloat(rows[0].price) : null;
}

/**
 * Return true if a new price row should be written.
 * Logs skipped unchanged rows at debug level.
 *
 * @param {number} newPrice
 * @param {number|null} lastPrice
 * @param {string} competitorId
 * @param {string} skuId
 * @returns {boolean}
 */
export function shouldWritePrice(newPrice, lastPrice, competitorId, skuId) {
  if (lastPrice === null) return true;

  if (newPrice === lastPrice) {
    log.debug({ competitorId, skuId, price: newPrice }, 'price unchanged — skipping DB write');
    return false;
  }

  return true;
}

/**
 * Insert a new row into price_history.
 *
 * @param {string} competitorId
 * @param {string} skuId
 * @param {number} price
 * @param {string} currency
 * @param {Date} scrapedAt
 * @returns {Promise<void>}
 */
export async function insertPriceRecord(competitorId, skuId, price, currency, scrapedAt) {
  await pool().query(
    `INSERT INTO bmc_market_intel.price_history
       (competitor_id, sku_id, price, currency, scraped_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [competitorId, skuId, price, currency, scrapedAt]
  );
}
