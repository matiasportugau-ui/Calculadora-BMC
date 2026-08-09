/**
 * Cross-channel automation engine (WAVE 3 F2).
 */
import { config } from "../../../config.js";
import { evaluateConditions, buildAutomationContext } from "./automationConditions.js";
import { enqueueAiJob } from "./aiWorker.js";
import { createDeal } from "../deals/dealService.js";
import { startOmniSpan } from "../otel.js";

/**
 * Allowed conversation statuses for the set_conversation_status action.
 * Single source of truth lives in ../conversationStatus.js (dependency-free);
 * re-exported here so existing importers keep working.
 */
export { ALLOWED_CONVERSATION_STATUSES } from "../conversationStatus.js";

/**
 * @param {import('pg').Pool} pool
 * @param {object} payload — message.ingested
 * @param {{ simulate?: boolean }} opts
 */
export async function runAutomationForEvent(pool, payload, opts = {}) {
  if (!pool) return { matched: [], simulated: opts.simulate };
  if (!config.omniAutomationEnabled && !opts.simulate && !opts.force) return { matched: [] };

  const span = startOmniSpan("omni.automation.run", { trace_id: payload.trace_id });
  const ctx = buildAutomationContext(payload);
  const triggerEvent = opts.triggerEvent || payload.trigger_event || "message.ingested";

  const params = [triggerEvent];
  const ruleIdClause = opts.ruleId ? "AND id = $2" : "";
  if (opts.ruleId) params.push(opts.ruleId);
  const { rows: rules } = await pool.query(
    `SELECT id, name, priority, trigger_event, conditions, actions, requires_approval
     FROM omni_automation_rules
     WHERE enabled = true AND trigger_event = $1
       ${ruleIdClause}
     ORDER BY priority ASC`,
    params,
  );

  const matched = [];
  for (const rule of rules) {
    if (!opts.skipConditions && !evaluateConditions(rule.conditions, ctx)) continue;

    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    if (opts.simulate) {
      matched.push({ rule_id: rule.id, name: rule.name, actions_would_run: actions });
      continue;
    }

    const idempotencyKey = opts.idempotencyKey?.(rule, payload) || payload.idempotency_key || `auto:${rule.id}:${payload.message_id}`;
    if (Array.isArray(opts.allowedActionTypes)) {
      const allowed = new Set(opts.allowedActionTypes);
      if (actions.some((action) => !allowed.has(action?.type))) continue;
    }
    const hitlDraftOnly = actions.length > 0 && actions.every((action) => action?.type === "ai_draft_followup");
    const runIns = await pool.query(
      `INSERT INTO omni_automation_runs (rule_id, idempotency_key, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, status`,
      [rule.id, idempotencyKey, rule.requires_approval && !hitlDraftOnly ? "pending_approval" : "running"],
    );
    if (!runIns.rows[0]) continue;

    const runId = runIns.rows[0].id;
    if (rule.requires_approval && !hitlDraftOnly) {
      matched.push({ rule_id: rule.id, run_id: runId, status: "pending_approval" });
      continue;
    }
    const results = [];
    const actionCtx = { ...ctx, rule: { id: rule.id, name: rule.name, trigger_event: rule.trigger_event } };
    const actionPayload = { ...payload, rule_id: rule.id, automation_run_id: runId };
    try {
      for (const action of actions) {
        results.push(await executeAction(pool, action, actionPayload, actionCtx));
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
      if (!ALLOWED_CONVERSATION_STATUSES.includes(params.status)) {
        return { type, skipped: true, reason: "invalid_status", status: params.status };
      }
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
    case "ai_draft_followup": {
      const jobId = await enqueueAiJob(pool, {
        job_type: "suggest",
        message_id: payload.message_id,
        conversation_id: payload.conversation_id,
        channel: payload.channel,
        input_json: {
          source: "sequence",
          action: "ai_draft_followup",
          automation_rule_id: payload.rule_id || ctx.rule?.id || null,
          automation_run_id: payload.automation_run_id || null,
          trigger_event: payload.trigger_event || null,
          requires_approval: true,
          requires_template: Boolean(payload.requires_template),
          sequence: {
            bucket: payload.sequence_bucket || null,
            hours_since_last_customer_reply: payload.hours_since_last_customer_reply ?? null,
            last_customer_at: payload.last_customer_at || null,
            last_agent_at: payload.last_agent_at || null,
          },
        },
      });
      return { type, job_id: jobId, requires_approval: true, requires_template: Boolean(payload.requires_template) };
    }
    case "create_deal": {
      const { rows: convRows } = await pool.query(
        `SELECT contact_id, channel FROM omni_conversations WHERE id = $1`,
        [payload.conversation_id],
      );
      const conv = convRows[0];
      if (!conv) return { type, skipped: true, reason: "conversation_not_found" };
      const titleTemplate = params.title_template || "Oportunidad — {channel}";
      const title = titleTemplate.replace("{channel}", conv.channel || "omni");
      const deal = await createDeal(pool, {
        contact_id: conv.contact_id,
        title,
        stage: params.stage || "lead",
        source_channel: conv.channel,
        source_conversation_id: payload.conversation_id,
        properties: { created_by: "automation" },
      });
      return { type, deal_id: deal.id };
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
