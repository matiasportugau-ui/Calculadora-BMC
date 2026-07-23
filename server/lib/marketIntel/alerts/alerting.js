// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import { randomUUID } from 'crypto';
import pg from 'pg';
import pino from 'pino';
import { getThresholds, determineAlertLevel } from './thresholds.js';
import { sendEmailAlert } from './email.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

let _pool = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    _pool.on('error', (err) => {
      log.warn({ err: err?.message, code: err?.code }, 'marketIntel alerts pg pool idle error');
    });
  }
  return _pool;
};

/**
 * Evaluate a price change and create/send alerts as needed.
 * Deduplication: one alert per (competitor_id + sku_id + level + UTC day).
 *
 * @param {{ competitor: object, sku: object, previousPrice: number|null, newPrice: number, runId: string }} input
 * @returns {Promise<void>}
 */
export async function processAlerts({ competitor, sku, previousPrice, newPrice, runId: _runId }) {
  if (previousPrice === null) return;

  const pctChange = Math.abs((newPrice - previousPrice) / previousPrice * 100);
  if (pctChange === 0) return;

  const thresholds = getThresholds();
  const level = determineAlertLevel(pctChange, thresholds);
  const utcDate = new Date().toISOString().slice(0, 10);
  const dedupKey = `${competitor.id}:${sku.id}:${level}:${utcDate}`;

  const signedPct = ((newPrice - previousPrice) / previousPrice * 100).toFixed(2);
  const message = `${competitor.name} — ${sku.name}: price changed from $${previousPrice.toFixed(2)} to $${newPrice.toFixed(2)} (${signedPct}%)`;

  const { rows } = await pool().query(
    `INSERT INTO bmc_market_intel.alerts
       (id, competitor_id, sku_id, level, message, price_before, price_after,
        pct_change, dedup_key, notified_email, notified_inapp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, FALSE)
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING *`,
    [randomUUID(), competitor.id, sku.id, level, message, previousPrice, newPrice, pctChange, dedupKey]
  );

  if (!rows.length) {
    log.debug({ dedupKey }, 'duplicate alert suppressed');
    return;
  }

  const alert = rows[0];
  log.info({ alertId: alert.id, level, dedupKey }, 'alert created');

  await dispatchNotifications(alert, level);
}

/**
 * Check if a competitor has been unreachable for ALERT_CRITICAL_OFFLINE_RUNS consecutive runs.
 * Creates a CRITICAL alert if threshold is exceeded.
 *
 * @param {object} competitor
 * @returns {Promise<void>}
 */
export async function checkOfflineCompetitor(competitor) {
  const { criticalOfflineRuns } = getThresholds();

  const { rows } = await pool().query(
    `SELECT COUNT(*) AS count
     FROM bmc_market_intel.etl_runs
     WHERE status IN ('partial', 'failed')
       AND errors @> $1::JSONB
       AND started_at >= NOW() - INTERVAL '7 days'`,
    [JSON.stringify([{ competitor_id: competitor.id }])]
  );

  const count = parseInt(rows[0]?.count ?? '0', 10);
  if (count < criticalOfflineRuns) return;

  const utcDate = new Date().toISOString().slice(0, 10);
  const dedupKey = `${competitor.id}:offline:critical:${utcDate}`;
  const message = `CRITICAL: ${competitor.name} (${competitor.domain}) unreachable for ${count} consecutive ETL runs`;

  const { rows: alertRows } = await pool().query(
    `INSERT INTO bmc_market_intel.alerts
       (id, competitor_id, sku_id, level, message, dedup_key, notified_email, notified_inapp)
     VALUES ($1, $2, NULL, 'critical', $3, $4, FALSE, FALSE)
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING *`,
    [randomUUID(), competitor.id, message, dedupKey]
  );

  if (!alertRows.length) return;

  log.warn({ alertId: alertRows[0].id, domain: competitor.domain, count }, message);
  await dispatchNotifications(alertRows[0], 'critical');
}

async function dispatchNotifications(alert, level) {
  // In-app: always (dashboard polls v_alert_counts)
  await pool().query(
    `UPDATE bmc_market_intel.alerts SET notified_inapp = TRUE WHERE id = $1`,
    [alert.id]
  );

  // Email: warning + critical only
  if (level === 'warning' || level === 'critical') {
    try {
      await sendEmailAlert(alert);
      await pool().query(
        `UPDATE bmc_market_intel.alerts SET notified_email = TRUE WHERE id = $1`,
        [alert.id]
      );
    } catch (err) {
      // Non-fatal — alert row is already committed
      log.error({ err, alertId: alert.id }, 'failed to send email alert');
    }
  }
}
