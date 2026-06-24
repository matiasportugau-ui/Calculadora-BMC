/**
 * Omni metrics collector (WAVE 3 K2).
 */
import { getOmniPool } from "./omniDb.js";

/**
 * @param {import('pg').Pool} pool
 */
export async function collectOmniMetrics(pool) {
  if (!pool) {
    return { ok: false, error: "omni_db_unavailable" };
  }

  const [
    ingest,
    aiPending,
    aiCompleted,
    automationRuns,
    conversationsByChannel,
    reconcileHint,
  ] = await Promise.all([
    pool.query(
      `SELECT channel, COUNT(*)::int AS total
       FROM omni_ingest_dedup
       WHERE created_at >= now() - interval '24 hours'
       GROUP BY channel`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS pending FROM omni_ai_jobs WHERE status = 'pending'`,
    ),
    pool.query(
      `SELECT job_type, status, COUNT(*)::int AS total
       FROM omni_ai_jobs
       WHERE created_at >= now() - interval '24 hours'
       GROUP BY job_type, status`,
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS total
       FROM omni_automation_runs
       WHERE started_at >= now() - interval '24 hours'
       GROUP BY status`,
    ),
    pool.query(
      `SELECT channel, COUNT(*)::int AS total FROM omni_conversations GROUP BY channel`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS duplicates
       FROM omni_ingest_dedup d
       WHERE d.message_id IS NOT NULL
         AND d.created_at >= now() - interval '24 hours'`,
    ),
  ]);

  const aiCost = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float AS total_usd
     FROM omni_ai_jobs WHERE created_at >= date_trunc('day', now())`,
  );

  return {
    ok: true,
    collected_at: new Date().toISOString(),
    omni_ingest_total_24h: ingest.rows,
    omni_ai_jobs_pending: aiPending.rows[0]?.pending ?? 0,
    omni_ai_jobs_completed_24h: aiCompleted.rows,
    omni_ai_cost_usd_today: aiCost.rows[0]?.total_usd ?? 0,
    omni_automation_executions_24h: automationRuns.rows,
    omni_conversations_by_channel: conversationsByChannel.rows,
    omni_ingest_dedup_24h: reconcileHint.rows[0]?.duplicates ?? 0,
  };
}

/**
 * Prometheus-style text (subset).
 */
export function formatPrometheusMetrics(data) {
  const lines = [];
  lines.push("# HELP omni_ai_jobs_pending Pending AI jobs");
  lines.push("# TYPE omni_ai_jobs_pending gauge");
  lines.push(`omni_ai_jobs_pending ${data.omni_ai_jobs_pending ?? 0}`);
  lines.push("# HELP omni_ai_cost_usd_today AI cost USD today");
  lines.push("# TYPE omni_ai_cost_usd_today counter");
  lines.push(`omni_ai_cost_usd_today ${data.omni_ai_cost_usd_today ?? 0}`);
  for (const row of data.omni_conversations_by_channel || []) {
    lines.push(`omni_conversations{channel="${row.channel}"} ${row.total}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} [databaseUrl]
 */
export async function getOmniMetricsSnapshot(databaseUrl) {
  const pool = getOmniPool(databaseUrl);
  return collectOmniMetrics(pool);
}
