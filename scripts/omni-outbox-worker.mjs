#!/usr/bin/env node
/**
 * Procesa jobs omni_outbox en loop (útil como proceso aparte o cron).
 * Uso: DATABASE_URL=... node scripts/omni-outbox-worker.mjs [--once]
 */
import dotenv from "dotenv";
import pg from "pg";
import { config } from "../server/config.js";
import pino from "pino";
import {
  claimNextOmniOutboxJob,
  completeOmniJob,
  processOmniOutboxJob,
} from "../server/lib/omniOutboxProcessor.js";

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const once = process.argv.includes("--once");

async function tick(pool) {
  const job = await claimNextOmniOutboxJob(pool);
  if (!job) return false;
  try {
    await processOmniOutboxJob(pool, config, logger, job);
    await completeOmniJob(pool, job.id, null);
  } catch (err) {
    logger.warn({ err: err.message, jobId: job.id }, "omni job failed");
    await completeOmniJob(pool, job.id, err.message);
  }
  return true;
}

async function main() {
  const url = process.env.OMNI_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  if (once) {
    await tick(pool);
    await pool.end();
    return;
  }
  for (;;) {
    const did = await tick(pool);
    if (!did) await new Promise((r) => setTimeout(r, 3000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
