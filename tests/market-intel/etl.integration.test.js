// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Integration tests for ETL pipeline — require TEST_DATABASE_URL.
// Skipped automatically when TEST_DATABASE_URL is unset.
// Run: TEST_DATABASE_URL=postgresql://... node --test tests/market-intel/etl.integration.test.js

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

const SKIP = !process.env.TEST_DATABASE_URL;
const COMP_ID = '11111111-1111-1111-1111-111111111111';
const SKU_ID  = '22222222-2222-2222-2222-222222222222';

describe('ETL Integration', { skip: SKIP ? 'TEST_DATABASE_URL not set' : false }, () => {
  let pool;

  before(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

    // Seed fixtures
    await pool.query(
      `INSERT INTO bmc_market_intel.competitors (id, name, domain, website_url)
       VALUES ($1, 'Test Competitor', 'test-etl.uy', 'https://test-etl.uy')
       ON CONFLICT (domain) DO NOTHING`,
      [COMP_ID]
    );
    await pool.query(
      `INSERT INTO bmc_market_intel.skus (id, competitor_id, name, url, price_selector)
       VALUES ($1, $2, 'Test SKU', 'https://test-etl.uy/p/1', '.price')
       ON CONFLICT (id) DO NOTHING`,
      [SKU_ID, COMP_ID]
    );
  });

  after(async () => {
    await pool.query(`DELETE FROM bmc_market_intel.price_history WHERE competitor_id = $1`, [COMP_ID]);
    await pool.query(`DELETE FROM bmc_market_intel.skus WHERE id = $1`, [SKU_ID]);
    await pool.query(`DELETE FROM bmc_market_intel.competitors WHERE id = $1`, [COMP_ID]);
    await pool.end();
  });

  test('upsertCompetitor: deduplicates on normalized domain', async () => {
    const { upsertCompetitor } = await import('../../server/lib/marketIntel/etl/deduplication.js');

    const a = await upsertCompetitor({ name: 'TC', domain: 'www.test-etl.uy', website_url: 'https://test-etl.uy' });
    const b = await upsertCompetitor({ name: 'TC Updated', domain: 'test-etl.uy', website_url: 'https://test-etl.uy' });

    assert.equal(a.id, b.id);
    assert.equal(b.name, 'TC Updated');
    assert.equal(b.domain, 'test-etl.uy');
  });

  test('getLastPrice: returns null for first observation', async () => {
    const { getLastPrice } = await import('../../server/lib/marketIntel/etl/delta.js');
    const last = await getLastPrice(COMP_ID, SKU_ID);
    assert.equal(last, null);
  });

  test('insertPriceRecord + getLastPrice: round-trip', async () => {
    const { getLastPrice, shouldWritePrice, insertPriceRecord } = await import('../../server/lib/marketIntel/etl/delta.js');

    const last = await getLastPrice(COMP_ID, SKU_ID);
    assert.equal(shouldWritePrice(100, last, COMP_ID, SKU_ID), true);

    await insertPriceRecord(COMP_ID, SKU_ID, 100, 'UYU', new Date());

    const after = await getLastPrice(COMP_ID, SKU_ID);
    assert.equal(after, 100);
  });

  test('shouldWritePrice: unchanged price skips write (DB row count unchanged)', async () => {
    const { getLastPrice, shouldWritePrice } = await import('../../server/lib/marketIntel/etl/delta.js');

    const last = await getLastPrice(COMP_ID, SKU_ID);
    assert.equal(last, 100);
    assert.equal(shouldWritePrice(100, last, COMP_ID, SKU_ID), false);

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS c FROM bmc_market_intel.price_history WHERE competitor_id = $1 AND sku_id = $2`,
      [COMP_ID, SKU_ID]
    );
    assert.equal(parseInt(rows[0].c, 10), 1);
  });

  test('insertPriceRecord: changed price adds new row', async () => {
    const { getLastPrice, shouldWritePrice, insertPriceRecord } = await import('../../server/lib/marketIntel/etl/delta.js');

    const last = await getLastPrice(COMP_ID, SKU_ID);
    assert.equal(shouldWritePrice(120, last, COMP_ID, SKU_ID), true);
    await insertPriceRecord(COMP_ID, SKU_ID, 120, 'UYU', new Date());

    const { rows } = await pool.query(
      `SELECT COUNT(*) AS c FROM bmc_market_intel.price_history WHERE competitor_id = $1 AND sku_id = $2`,
      [COMP_ID, SKU_ID]
    );
    assert.equal(parseInt(rows[0].c, 10), 2);
  });
});
