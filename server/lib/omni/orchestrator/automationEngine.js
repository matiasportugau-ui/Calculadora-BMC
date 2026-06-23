/**
 * Cross-channel automation engine (WAVE 3 F2).
 */
import { config } from "../../../config.js";
import { evaluateConditions, buildAutomationContext } from "./automationConditions.js";
import { enqueueAiJob } from "./aiWorker.js";
import { startOmniSpan } from "../otel.js";

/**
 * @param {import('pg').Pool} pool
 * @param {object} payload — message.ingested
 * @param {{ simulate?: boolean }} opts
 */
export async function runAutomationForEvent(pool, payload, opts = {}) {
  if (!pool) return { matched: [], simulated: opts.simulate };
  if (!config.omniAutomationEnabled && !opts.simulate) return { matched: [] };

  const span = startOmniSpan("omni.automation.run", { trace_id: payload.trace_id });
  const ctx = buildAutomationContext(payload);

  const { rows: rules } = await pool.query(
    `SELECT id, name, priority, trigger_event, conditions, actions, requires_approval
     FROM omni_automation_rules
     WHERE enabled = true AND trigger_event = $1
     ORDER BY priority ASC`,
    ["message.ingested"],
  );

  const matched = [];
  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, ctx)) continue;

    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    if (opts.simulate) {
      matched.push({ rule_id: rule.id, name: rule.name, actions_would_run: actions });
      continue;
    }

    const idempotencyKey = `auto:${rule.id}:${payload.message_id}`;
    const runIns = await pool.query(
      `INSERT INTO omni_automation_runs (rule_id, idempotency_key, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, status`,
      [rule.id, idempotencyKey, rule.requires_approval ? "pending_approval" : "running"],
    );
    if (!runIns.rows[0]) continue;

    const runId = runIns.rows[0].id;
    if (rule.requires_approval) {
      matched.push({ rule_id: rule.id, run_id: runId, status: "pending_approval" });
      continue;
    }

    const results = [];
    try {
      for (const action of actions) {
        results.push(await executeAction(pool, action, payload, ctx));
      }
      await pool.query(
        `UPDATE omni_automation_runs SET status = 'completed', actions_result = $2::jsonb, completed_at = now()
         WHERE id = $1`,
        [runId, JSON.stringify(results)],
      );
      matched.push({ rule_id: rule.id, run_id: runId, status: "completed", results });
    } catch (e) {
      await pool.query(
        `UPDATE omni_automation_runs SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`,
        [runId, e.message],
      );
      matched.push({ rule_id: rule.id, run_id: runId, status: "failed", error: e.message });
    }
  }

  span.end({ rules_evaluated: rules.length, matched: matched.length });
  return { matched };
}

async function executeAction(pool, action, payload, ctx) {
  const type = action?.type;
  const params = action?.params || {};

  switch (type) {
    case "tag_conversation": {
      const tags = params.tags || [];
      await pool.query(
        `UPDATE omni_conversations SET tags = (
           SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags, '{}') || $2::text[]))
         ), updated_at = now() WHERE id = $1`,
        [payload.conversation_id, tags],
      );
      return { type, tags };
    }
    case "set_priority": {
      await pool.query(
        `UPDATE omni_conversations SET priority = $2, updated_at = now() WHERE id = $1`,
        [payload.conversation_id, params.priority ?? 0],
      );
      return { type, priority: params.priority };
    }
    case "set_conversation_status": {
      await pool.query(
        `UPDATE omni_conversations SET status = $2, updated_at = now() WHERE id = $1`,
        [payload.conversation_id, params.status],
      );
      return { type, status: params.status };
    }
    case "enqueue_ai_job": {
      const jobId = await enqueueAiJob(pool, {
        job_type: params.job_type || "classify",
        message_id: payload.message_id,
        conversation_id: payload.conversation_id,
        channel: payload.channel,
        input_json: { source: "automation" },
      });
      return { type, job_id: jobId };
    }
    default:
      return { type, skipped: true, reason: "unknown_action" };
  }
}

/**
 * Simulate rule without side effects (F4).
 */
export async function simulateAutomationRule(pool, ruleId, sampleEvent) {
  const { rows } = await pool.query(`SELECT * FROM omni_automation_rules WHERE id = $1`, [ruleId]);
  const rule = rows[0];
  if (!rule) return { ok: false, error: "rule_not_found" };

  const ctx = buildAutomationContext(sampleEvent);
  const matched = evaluateConditions(rule.conditions, ctx);
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  return {
    ok: true,
    matched,
    actions_would_run: matched ? actions : [],
    rule: { id: rule.id, name: rule.name },
  };
}
