// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Cron scheduler for daily ETL run at 03:00 UTC.
// Import this in server/index.js to activate:
//   import './lib/marketIntel/scheduler.js';

import cron from 'node-cron';
import pino from 'pino';
import { runEtl } from './etl/runner.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

if (process.env.NODE_ENV !== 'test') {
  // Daily at 03:00 UTC
  cron.schedule('0 3 * * *', () => {
    log.info('scheduled ETL run triggered');
    runEtl().catch(err => log.error({ err }, 'scheduled ETL run failed'));
  }, { timezone: 'UTC' });

  log.info('market-intel ETL scheduler registered (03:00 UTC daily)');
}
