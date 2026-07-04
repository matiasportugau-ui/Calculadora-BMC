// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Cron scheduler for daily ETL run at 03:00 UTC.
// Import this in server/index.js to activate:
//   import './lib/marketIntel/scheduler.js';

import cron from 'node-cron';
import pino from 'pino';
import { runEtl } from './etl/runner.js';
import { startKeywordRefresh } from './keywordMonitor.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

if (process.env.NODE_ENV !== 'test') {
  // Daily at 03:00 UTC
  cron.schedule('0 3 * * *', () => {
    log.info('scheduled ETL run triggered');
    runEtl().catch(err => log.error({ err }, 'scheduled ETL run failed'));
  }, { timezone: 'UTC' });

  log.info('market-intel ETL scheduler registered (03:00 UTC daily)');

  // P1 keywords daily at 04:00 UTC (after price ETL)
  cron.schedule('0 4 * * *', () => {
    log.info('scheduled keyword refresh (P1) triggered');
    const job = startKeywordRefresh({ priority: 'P1' });
    if (!job.started) {
      log.warn({ active: job.meta }, 'scheduled P1 keyword refresh skipped because another refresh is running');
      return;
    }
    job.promise.catch((err) => log.error({ err }, 'scheduled P1 keyword refresh failed'));
  }, { timezone: 'UTC' });

  // Full keyword universe weekly (Sunday 05:00 UTC)
  cron.schedule('0 5 * * 0', () => {
    log.info('scheduled full keyword refresh triggered');
    const job = startKeywordRefresh();
    if (!job.started) {
      log.warn({ active: job.meta }, 'scheduled full keyword refresh skipped because another refresh is running');
      return;
    }
    job.promise.catch((err) => log.error({ err }, 'scheduled full keyword refresh failed'));
  }, { timezone: 'UTC' });

  log.info('keyword monitor scheduler registered (P1 daily 04:00 UTC, full weekly Sun 05:00 UTC)');
}
