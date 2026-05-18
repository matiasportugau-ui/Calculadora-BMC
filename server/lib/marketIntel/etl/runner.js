// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import { randomUUID } from 'crypto';
import pg from 'pg';
import pino from 'pino';
import { isScrapingAllowed } from './robots.js';
import { scrapeSku, delay } from './scraper.js';
import { getLastPrice, shouldWritePrice, insertPriceRecord } from './delta.js';
import { createMysteryShoppingTask } from '../mysteryShoppingQueue.js';
import { processAlerts } from '../alerts/alerting.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

let _pool = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
};

/**
 * Execute a full ETL run: load active competitors, scrape SKUs,
 * apply delta detection, write price records, process alerts,
 * create mystery shopping tasks on block, and finalize etl_runs row.
 *
 * @returns {Promise<object>} - The completed etl_run record
 */
export async function runEtl() {
  const runId = randomUUID();
  const startedAt = new Date();

  log.info({ runId }, 'ETL run started');

  // Persist run start so dashboard shows in-progress immediately
  await pool().query(
    `INSERT INTO bmc_market_intel.etl_runs
       (run_id, started_at, status, competitors_attempted, competitors_succeeded, errors)
     VALUES ($1, $2, 'failed', 0, 0, '[]'::JSONB)`,
    [runId, startedAt]
  );

  let competitorsAttempted = 0;
  let competitorsSucceeded = 0;
  const errors = [];

  try {
    const targets = await loadTargets();
    competitorsAttempted = targets.length;
    log.info({ runId, competitorsAttempted }, 'targets loaded');

    for (const { competitor, skus } of targets) {
      const result = await processCompetitor(competitor, skus, runId);
      if (result.success) {
        competitorsSucceeded++;
      } else if (result.error) {
        errors.push(result.error);
      }
      await delay(2_000);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, runId }, 'ETL runner fatal error');
    errors.push({
      competitor_id: 'runner',
      competitor_domain: 'N/A',
      stage: 'fetch',
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // success only if ALL attempted competitors succeeded
  const status = errors.length === 0
    ? 'success'
    : competitorsSucceeded > 0
    ? 'partial'
    : 'failed';

  const finishedAt = new Date();

  await pool().query(
    `UPDATE bmc_market_intel.etl_runs
     SET finished_at           = $1,
         status                = $2,
         competitors_attempted = $3,
         competitors_succeeded = $4,
         errors                = $5::JSONB,
         updated_at            = NOW()
     WHERE run_id = $6`,
    [finishedAt, status, competitorsAttempted, competitorsSucceeded, JSON.stringify(errors), runId]
  );

  // Refresh materialized view — non-fatal on failure
  try {
    await pool().query(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY bmc_market_intel.mv_daily_price_summary`
    );
  } catch (err) {
    log.warn({ err }, 'mv_daily_price_summary refresh failed (non-fatal)');
  }

  log.info({ runId, status, competitorsAttempted, competitorsSucceeded, errorCount: errors.length }, 'ETL run finished');

  return { run_id: runId, started_at: startedAt, finished_at: finishedAt, status, competitors_attempted: competitorsAttempted, competitors_succeeded: competitorsSucceeded, errors };
}

// ─── Internal helpers ──────────────────────────────────────────────

async function loadTargets() {
  const { rows: competitors } = await pool().query(
    `SELECT * FROM bmc_market_intel.competitors WHERE is_active = TRUE ORDER BY name`
  );

  const targets = [];
  for (const competitor of competitors) {
    const { rows: skus } = await pool().query(
      `SELECT * FROM bmc_market_intel.skus WHERE competitor_id = $1 AND is_tracked = TRUE`,
      [competitor.id]
    );
    targets.push({ competitor, skus });
  }

  return targets;
}

async function processCompetitor(competitor, skus, runId) {
  log.info({ competitorId: competitor.id, domain: competitor.domain }, 'processing competitor');

  if (!skus.length) {
    log.warn({ competitorId: competitor.id }, 'no tracked SKUs — skipping');
    return { competitor, success: true, results: [] };
  }

  let firstPath;
  try {
    firstPath = new URL(skus[0].url).pathname;
  } catch {
    firstPath = '/';
  }

  const allowed = await isScrapingAllowed(competitor.domain, firstPath);

  if (!allowed) {
    const message = `robots.txt disallows scraping ${competitor.domain}${firstPath}`;
    log.warn({ competitorId: competitor.id }, message);

    await createMysteryShoppingTask({
      competitor_id: competitor.id,
      reason: 'blocked',
      notes: `robots.txt disallows automated scraping. Run ID: ${runId}`,
    });

    return {
      competitor,
      success: false,
      results: [],
      error: {
        competitor_id: competitor.id,
        competitor_domain: competitor.domain,
        stage: 'robots_check',
        message,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const results = [];
  let skuErrors = 0;

  for (const sku of skus) {
    const outcome = await scrapeSku(sku);

    if (outcome.kind === 'blocked') {
      log.warn({ skuId: sku.id, httpStatus: outcome.httpStatus }, 'SKU blocked — creating mystery shopping task');
      await createMysteryShoppingTask({
        competitor_id: competitor.id,
        reason: 'blocked',
        notes: `HTTP ${outcome.httpStatus} on ${sku.url}. Run ID: ${runId}`,
      });
      skuErrors++;
      continue;
    }

    if (outcome.kind === 'parse_error' || outcome.kind === 'network_error') {
      log.error({ skuId: sku.id, kind: outcome.kind, message: outcome.message }, 'SKU scrape failed');

      if (outcome.kind === 'parse_error') {
        const recurringCount = await getConsecutiveParseErrors(competitor.id, sku.id);
        if (recurringCount >= 3) {
          await createMysteryShoppingTask({
            competitor_id: competitor.id,
            reason: 'recurring_parse_error',
            notes: `Parse error on ${sku.url} for ${recurringCount} consecutive runs. Run ID: ${runId}`,
          });
        }
      }

      skuErrors++;
      continue;
    }

    // outcome.kind === 'success'
    const scrapedAt = new Date();
    const lastPrice = await getLastPrice(competitor.id, sku.id);

    if (shouldWritePrice(outcome.price, lastPrice, competitor.id, sku.id)) {
      const client = await pool().connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO bmc_market_intel.price_history
             (competitor_id, sku_id, price, currency, scraped_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [competitor.id, sku.id, outcome.price, outcome.currency, scrapedAt]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await processAlerts({ competitor, sku, previousPrice: lastPrice, newPrice: outcome.price, runId });
    }

    results.push({ competitor_id: competitor.id, sku_id: sku.id, price: outcome.price, currency: outcome.currency, scraped_at: scrapedAt });
    await delay(2_000);
  }

  return { competitor, success: skuErrors === 0, results };
}

async function getConsecutiveParseErrors(competitorId, _skuId) {
  const { rows } = await pool().query(
    `SELECT COUNT(*) AS count
     FROM bmc_market_intel.etl_runs
     WHERE status IN ('partial', 'failed')
       AND errors @> $1::JSONB
       AND started_at >= NOW() - INTERVAL '30 days'`,
    [JSON.stringify([{ competitor_id: competitorId }])]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}
