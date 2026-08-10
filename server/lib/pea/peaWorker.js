/**
 * PEA durable job worker — in-process loop (ADR-011).
 */
import { dispatchPendingOutbox } from "./outbox.js";

const STALE_RUNNING_MINUTES = 15;

/**
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} cfg
 * @param {object} job
 * @param {import('pino').Logger|object} [logger]
 */
export async function processPeaJob(pool, cfg, job, logger) {
  const log = logger || { info() {}, warn() {} };
  if (job.job_type === "dispatch_outbox") {
    const outboxId = job.input_json?.outbox_id;
    log.info?.({ job_id: job.id, outbox_id: outboxId }, "pea dispatch_outbox ack");
    await pool.query(
      `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
      [job.id, JSON.stringify({ ok: true, outbox_id: outboxId })],
    );
    return;
  }
  if (job.job_type === "worker_tick") {
    const result = await dispatchPendingOutbox(pool, 10);
    await pool.query(
      `UPDATE pea.jobs SET status = 'completed', output_json = $2::jsonb, completed_at = now() WHERE id = $1`,
      [job.id, JSON.stringify(result)],
    );
    return;
  }
  if (job.job_type === "analyze_gap") {
    const { runAnalyzeGapJob } = await import("./analyzeGapJob.js");
    await runAnalyzeGapJob(pool, cfg, job, log);
    return;
  }
  if (job.job_type === "implement_gap") {
    const { runImplementGapJob } = await import("./implementGapJob.js");
    await runImplementGapJob(pool, cfg, job);
    return;
  }
  await markPeaJobFailed(pool, job, "unknown_job_type", log);
}

async function markPeaJobFailed(pool, jobRow, error, logger) {
  const { rows } = await pool.query(
    `UPDATE pea.jobs SET
       status = CASE WHEN attempts >= 2 THEN 'dead' ELSE 'failed' END,
       error = $2,
       completed_at = now()
     WHERE id = $1
     RETURNING status`,
    [jobRow.id, error],
  );
  if (rows[0]?.status === "dead") {
    logger?.warn?.({ job_id: jobRow.id, job_type: jobRow.job_type, error }, "pea job DEAD");
  }
}

/**
 * Claim and process one batch (exported for Scheduler tick / tests).
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} cfg
 * @param {import('pino').Logger|object} [logger]
 */
export async function claimAndRunPeaBatch(pool, cfg, logger) {
  const log = logger || { warn() {} };
  // Bug CW: stale reclaim must respect attempts → dead, otherwise hung jobs
  // bounce forever (failed → reclaim → running → stale → failed…) and never
  // dead-letter. markPeaJobFailed already uses attempts >= 2 → dead on throw.
  await pool.query(
    `UPDATE pea.jobs SET
       status = CASE WHEN attempts >= 2 THEN 'dead' ELSE 'failed' END,
       error = 'stale_running_recovered',
       completed_at = now()
     WHERE status = 'running'
       AND started_at IS NOT NULL
       AND started_at < now() - interval '${STALE_RUNNING_MINUTES} minutes'`,
  );

  const client = await pool.connect();
  let jobs = [];
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM pea.jobs
        WHERE status IN ('pending', 'failed')
          AND (run_after IS NULL OR run_after <= now())
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [cfg.peaWorkerBatchSize || 2],
    );
    for (const job of rows) {
      await client.query(
        `UPDATE pea.jobs SET status = 'running', started_at = now(), attempts = attempts + 1 WHERE id = $1`,
        [job.id],
      );
    }
    await client.query("COMMIT");
    jobs = rows;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    log.warn?.({ err: e.message }, "pea worker claim failed");
    return { processed: 0 };
  } finally {
    client.release();
  }

  for (const job of jobs) {
    try {
      await processPeaJob(pool, cfg, job, log);
    } catch (e) {
      await markPeaJobFailed(pool, job, e.message || "process_error", log);
    }
  }
  return { processed: jobs.length };
}

/**
 * @param {{ config: import('../../config.js').config, logger: import('pino').Logger, pool: import('pg').Pool|null }} opts
 */
export function startPeaWorker({ config: cfg, logger, pool }) {
  const log = logger || { info() {}, warn() {} };
  if (!pool) {
    log.warn("[peaWorker] no pool, worker not started");
    return () => {};
  }
  if (!cfg.peaEnabled || !cfg.peaWorkerEnabled) {
    log.info("[peaWorker] disabled (PEA_ENABLED/PEA_WORKER_ENABLED=false)");
    return () => {};
  }

  let timer = null;
  let running = false;
  let active = 0;
  const maxConcurrency = cfg.peaMaxConcurrency || 2;

  async function tick() {
    if (running) return;
    if (active >= maxConcurrency) return;
    running = true;
    active += 1;
    try {
      await claimAndRunPeaBatch(pool, cfg, log);
    } catch (e) {
      log.warn?.({ err: e.message }, "[peaWorker] tick failed");
    } finally {
      active -= 1;
      running = false;
    }
  }

  const intervalMs = cfg.peaWorkerIntervalMs || 5000;
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick().catch(() => {});
  log.info({ intervalMs, maxConcurrency }, "[peaWorker] started");
  return () => {
    if (timer) clearInterval(timer);
  };
}
