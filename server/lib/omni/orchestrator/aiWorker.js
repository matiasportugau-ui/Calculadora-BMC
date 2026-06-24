/**
 * Omni AI job queue + worker (WAVE 3 E1/E2).
 */
import { config } from "../../../config.js";
import { callAgentOnce } from "../../agentCore.js";
import { classifyIntent } from "../../waEnricher.js";
import { startOmniSpan } from "../otel.js";
import { getEnabledPrompt, getEnabledModel } from "./aiRegistry.js";
import { processExtractDealJob } from "../deals/dealExtractor.js";
import { runEmbedJob } from "../knowledge/embedPipeline.js";
import { buildOmniRetrievalContext, formatOmniContextBlock } from "../knowledge/kbBridge.js";

const CATEGORY_MAP = {
  cotizacion: "cotizacion",
  consulta_tecnica: "product",
  follow_up: "inquiry",
  objecion: "complaint",
  cierre: "order",
  chatter: "inquiry",
};

/**
 * Allowlist of AI job types. Mirrors the DB CHECK constraint in
 * server/migrations/omni/002_ai_automation.sql (omni_ai_jobs_type_valid).
 * Single source of truth so routes/actions validate before hitting the DB.
 */
export const ALLOWED_AI_JOB_TYPES = ["classify", "suggest", "extract_deal", "embed"];

/**
 * @param {import('pg').Pool} pool
 * @param {object} job
 */
export async function enqueueAiJob(pool, job) {
  if (!pool) return null;
  if (!ALLOWED_AI_JOB_TYPES.includes(job.job_type)) {
    throw new Error("invalid_job_type");
  }
  const { rows } = await pool.query(
    `INSERT INTO omni_ai_jobs (job_type, message_id, conversation_id, channel, input_json, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
     RETURNING id`,
    [
      job.job_type,
      job.message_id,
      job.conversation_id,
      job.channel || null,
      JSON.stringify(job.input_json || {}),
    ],
  );
  return rows[0]?.id ?? null;
}

/**
 * Enqueue classify + suggest for new customer messages.
 */
export async function enqueueIngestAiJobs(pool, payload) {
  if (!config.omniAiOrchestratorEnabled || !pool) return [];
  if (payload.duplicate) return [];
  if (payload.message?.sender !== "customer") return [];

  const ids = [];
  ids.push(
    await enqueueAiJob(pool, {
      job_type: "classify",
      message_id: payload.message_id,
      conversation_id: payload.conversation_id,
      channel: payload.channel,
    }),
  );
  ids.push(
    await enqueueAiJob(pool, {
      job_type: "suggest",
      message_id: payload.message_id,
      conversation_id: payload.conversation_id,
      channel: payload.channel,
    }),
  );
  return ids.filter(Boolean);
}

async function getDailyAiCost(pool) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float AS total
     FROM omni_ai_jobs
     WHERE created_at >= date_trunc('day', now())`,
  );
  return rows[0]?.total ?? 0;
}

/**
 * Process one AI job.
 */
export async function processAiJob(pool, jobRow, logger) {
  const span = startOmniSpan("omni.ai.job", { job_type: jobRow.job_type, ai_run_id: jobRow.id });
  const t0 = Date.now();

  const { rows: msgRows } = await pool.query(
    `SELECT m.body, m.sender, c.channel
     FROM omni_messages m
     JOIN omni_conversations c ON c.id = m.conversation_id
     WHERE m.id = $1`,
    [jobRow.message_id],
  );
  const msg = msgRows[0];
  if (!msg) {
    await markJobFailed(pool, jobRow.id, "message_not_found");
    span.end();
    return;
  }

  try {
    if (jobRow.job_type === "classify") {
      const intent = classifyIntent(msg.body);
      const category = CATEGORY_MAP[intent] || "inquiry";
      await pool.query(
        `UPDATE omni_messages SET body_ai_category = $2 WHERE id = $1`,
        [jobRow.message_id, category],
      );
      await markJobCompleted(pool, jobRow.id, {
        intent,
        category,
        confidence: intent === "chatter" ? 0.5 : 0.85,
        latency_ms: Date.now() - t0,
        cost_usd: 0,
      });
      if (category === "cotizacion" || intent === "cotizacion") {
        await enqueueAiJob(pool, {
          job_type: "extract_deal",
          message_id: jobRow.message_id,
          conversation_id: jobRow.conversation_id,
          channel: jobRow.channel,
        });
      }
    } else if (jobRow.job_type === "suggest") {
      const channel = msg.channel === "ml" ? "ml" : msg.channel === "wa" ? "wa" : "chat";
      const prompt = await getEnabledPrompt(pool, "suggest", channel);
      const model = await getEnabledModel(pool, "suggest");

      if (!model) {
        await markJobCompleted(pool, jobRow.id, {
          skipped: true,
          reason: "registry_disabled",
          latency_ms: Date.now() - t0,
          cost_usd: 0,
        });
        span.end();
        return;
      }

      const retrieval = await buildOmniRetrievalContext(pool, jobRow.conversation_id, msg.body);
      const contextBlock = formatOmniContextBlock(retrieval);
      const userContent = contextBlock
        ? `${contextBlock}\n\n---\nCustomer message:\n${msg.body}`
        : msg.body;

      const result = await callAgentOnce(
        [{ role: "user", content: userContent }],
        {
          channel,
          taskKey: prompt?.system_prompt ? null : "suggestions",
          systemPrompt: prompt?.system_prompt || undefined,
          override: model
            ? {
                provider: model.provider,
                model: model.model_id,
                maxTokens: model.max_tokens,
                temperature: model.temperature,
              }
            : null,
        },
      );

      const body = String(result.text || "").trim().slice(0, 2000);
      if (body) {
        await pool.query(
          `INSERT INTO omni_suggestions (message_id, conversation_id, job_id, channel, body, metadata)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
          [
            jobRow.message_id,
            jobRow.conversation_id,
            jobRow.id,
            channel,
            body,
            JSON.stringify({
              provider: result.provider,
              model: result.model,
              prompt_version: prompt?.version ?? null,
            }),
          ],
        );
      }

      await markJobCompleted(pool, jobRow.id, {
        text_len: body.length,
        provider: result.provider,
        latency_ms: result.latencyMs ?? Date.now() - t0,
        cost_usd: result.estimatedCostUsd ?? 0,
        prompt_version: prompt?.version ?? null,
      });
    } else if (jobRow.job_type === "extract_deal") {
      const extracted = await processExtractDealJob(pool, jobRow);
      await markJobCompleted(pool, jobRow.id, {
        ...extracted,
        latency_ms: Date.now() - t0,
        cost_usd: 0,
      });
    } else if (jobRow.job_type === "embed") {
      const embedded = await runEmbedJob(pool, jobRow.message_id);
      await markJobCompleted(pool, jobRow.id, {
        ...embedded,
        latency_ms: Date.now() - t0,
        cost_usd: 0,
      });
    } else {
      await markJobFailed(pool, jobRow.id, "unsupported_job_type");
    }
  } catch (e) {
    logger?.warn?.({ err: e.message, job_id: jobRow.id }, "omni ai job failed");
    await markJobFailed(pool, jobRow.id, e.message);
  }
  span.end();
}

async function markJobCompleted(pool, jobId, output) {
  await pool.query(
    `UPDATE omni_ai_jobs SET
       status = 'completed',
       output_json = $2::jsonb,
       confidence = $3,
       latency_ms = $4,
       cost_usd = $5,
       completed_at = now()
     WHERE id = $1`,
    [
      jobId,
      JSON.stringify(output),
      output.confidence ?? null,
      output.latency_ms ?? null,
      output.cost_usd ?? 0,
    ],
  );
}

async function markJobFailed(pool, jobId, error) {
  await pool.query(
    `UPDATE omni_ai_jobs SET
       status = CASE WHEN attempts >= 2 THEN 'dead' ELSE 'failed' END,
       error = $2,
       completed_at = now()
     WHERE id = $1`,
    [jobId, error],
  );
}

/**
 * Run AI job by id (E4 internal endpoint).
 */
export async function runAiJobById(pool, jobId, opts = {}) {
  const { rows } = await pool.query(`SELECT * FROM omni_ai_jobs WHERE id = $1`, [jobId]);
  const job = rows[0];
  if (!job) return { ok: false, error: "job_not_found" };
  if (job.status === "completed") return { ok: true, already_completed: true, job };

  const dailyCost = await getDailyAiCost(pool);
  if (dailyCost >= config.omniAiDailyBudgetUsd) {
    return { ok: false, error: "ai_daily_budget_exceeded" };
  }

  await pool.query(
    `UPDATE omni_ai_jobs SET status = 'running', started_at = now(), attempts = attempts + 1 WHERE id = $1`,
    [jobId],
  );
  await processAiJob(pool, { ...job, id: jobId }, opts.logger);
  const { rows: updated } = await pool.query(`SELECT * FROM omni_ai_jobs WHERE id = $1`, [jobId]);
  return { ok: true, job: updated[0] };
}

/**
 * Create and immediately run an ad-hoc AI job (E4).
 */
export async function runAdHocAiJob(pool, params, logger) {
  const jobId = await enqueueAiJob(pool, params);
  if (!jobId) return { ok: false, error: "enqueue_failed" };
  return runAiJobById(pool, jobId, { logger });
}

export function startOmniAiWorker({ config: cfg, logger, pool }) {
  const log = logger || { info() {}, warn() {} };
  if (!pool) {
    log.warn("[omniAiWorker] no pool, worker not started");
    return () => {};
  }
  if (!cfg.omniAiOrchestratorEnabled) {
    log.info("[omniAiWorker] disabled (OMNI_AI_ORCHESTRATOR_ENABLED=false)");
    return () => {};
  }

  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const dailyCost = await getDailyAiCost(pool);
      if (dailyCost >= cfg.omniAiDailyBudgetUsd) {
        log.warn({ dailyCost }, "[omniAiWorker] daily budget exceeded, skipping batch");
        return;
      }

      await pool.query(
        `UPDATE omni_ai_jobs SET
           status = 'failed',
           error = 'stale_running_recovered',
           completed_at = now()
         WHERE status = 'running'
           AND started_at IS NOT NULL
           AND started_at < now() - interval '15 minutes'`,
      );

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          `SELECT * FROM omni_ai_jobs
           WHERE status IN ('pending', 'failed')
           ORDER BY created_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED`,
          [cfg.omniAiWorkerBatchSize],
        );
        for (const job of rows) {
          await client.query(
            `UPDATE omni_ai_jobs SET status = 'running', started_at = now(), attempts = attempts + 1 WHERE id = $1`,
            [job.id],
          );
        }
        await client.query("COMMIT");

        for (const job of rows) {
          await processAiJob(pool, job, log);
        }
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        log.warn({ err: e.message }, "[omniAiWorker] batch error");
      } finally {
        client.release();
      }
    } finally {
      running = false;
    }
  }

  timer = setInterval(tick, cfg.omniAiWorkerIntervalMs);
  tick().catch(() => {});

  return () => {
    if (timer) clearInterval(timer);
  };
}
