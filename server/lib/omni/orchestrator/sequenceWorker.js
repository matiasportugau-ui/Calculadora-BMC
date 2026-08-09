// Temporal follow-up sequences (Gap 4).
// Evaluates automation rules on a timer and enqueues HITL AI draft suggestions.

import { runAutomationForEvent } from "./automationEngine.js";

const DEFAULT_INTERVAL_MS = 300_000;
const MAX_HOURS = 24 * 30;

function clampHours(value, fallback = 24) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 1), MAX_HOURS);
}

function bucketFor(_date, hours) {
  const ms = Date.now();
  const bucketMs = clampHours(hours) * 60 * 60 * 1000;
  return String(Math.floor(ms / bucketMs));
}

export function noReplyRuleConfig(rule) {
  const c = rule?.conditions && typeof rule.conditions === "object" ? rule.conditions : {};
  return {
    hours: clampHours(c.hours_since_last_customer_reply ?? c.no_reply_hours ?? c.hours, 24),
    onlyOpen: c.only_open_conversations !== false,
    limit: Math.min(Math.max(Number(c.limit) || 50, 1), 200),
  };
}

function isDraftOnlyRule(rule) {
  const actions = Array.isArray(rule?.actions) ? rule.actions : [];
  return actions.length > 0 && actions.every((action) => action?.type === "ai_draft_followup");
}

function hasDslConditions(conditions) {
  return ["all", "any", "none"].some((key) => Array.isArray(conditions?.[key]) && conditions[key].length > 0);
}

export async function findNoReplyCandidates(pool, rule) {
  const cfg = noReplyRuleConfig(rule);
  const params = [cfg.hours, rule.id, cfg.limit];
  const statusClause = cfg.onlyOpen ? "AND c.status = 'open'" : "";
  const { rows } = await pool.query(
    `WITH last_messages AS (
       SELECT DISTINCT ON (m.conversation_id)
              m.conversation_id, m.id AS message_id, m.sender AS last_sender, m.created_at AS last_message_at
         FROM omni_messages m
        ORDER BY m.conversation_id, m.created_at DESC
     ),
     last_customer AS (
       SELECT DISTINCT ON (m.conversation_id)
              m.conversation_id, m.id AS message_id, m.created_at AS last_customer_at
         FROM omni_messages m
        WHERE m.sender = 'customer'
        ORDER BY m.conversation_id, m.created_at DESC
     ),
     last_agent AS (
       SELECT m.conversation_id, MAX(m.created_at) AS last_agent_at
         FROM omni_messages m
        WHERE m.sender IN ('agent', 'bot')
        GROUP BY m.conversation_id
     )
     SELECT c.id AS conversation_id, c.channel, c.status AS conversation_status,
            lc.message_id, lc.last_customer_at, la.last_agent_at,
            FLOOR(EXTRACT(EPOCH FROM (now() - lc.last_customer_at)) / 3600)::int AS hours_since_last_customer_reply,
            (c.channel = 'wa' AND lc.last_customer_at < now() - interval '24 hours') AS requires_template
       FROM omni_conversations c
       JOIN last_messages lm ON lm.conversation_id = c.id
       JOIN last_customer lc ON lc.conversation_id = c.id
       JOIN last_agent la ON la.conversation_id = c.id
      WHERE lm.last_sender IN ('agent', 'bot')
        AND la.last_agent_at >= lc.last_customer_at
        AND lc.last_customer_at <= now() - ($1::int * interval '1 hour')
        ${statusClause}
        AND NOT EXISTS (
          SELECT 1 FROM omni_suggestions s
           WHERE s.conversation_id = c.id
             AND s.approval_state = 'pending'
             AND s.metadata->>'automation_rule_id' = $2::text
        )
        AND NOT EXISTS (
          SELECT 1 FROM omni_ai_jobs j
           WHERE j.conversation_id = c.id
             AND j.job_type = 'suggest'
             AND j.status IN ('pending', 'running')
             AND j.input_json->>'automation_rule_id' = $2::text
        )
      ORDER BY lc.last_customer_at ASC
      LIMIT $3`,
    params,
  );
  return rows.map((row) => ({ ...row, sequence_bucket: bucketFor(row.last_customer_at, cfg.hours) }));
}

export async function findFollowupDueCandidates(pool, rule) {
  const limit = Math.min(Math.max(Number(rule?.conditions?.limit) || 50, 1), 200);
  try {
    const { rows } = await pool.query(
      `SELECT c.id AS conversation_id, c.channel, c.status AS conversation_status,
              lm.id AS message_id, f.due_at AS last_customer_at,
              f.due_at AS last_agent_at, f.id AS followup_id,
              FLOOR(EXTRACT(EPOCH FROM (now() - f.due_at)) / 3600)::int AS hours_since_last_customer_reply,
              false AS requires_template
         FROM wa_followups f
         JOIN omni_conversations c ON c.channel = 'wa' AND c.channel_conversation_id = f.chat_id
         JOIN LATERAL (
           SELECT id FROM omni_messages m
            WHERE m.conversation_id = c.id
              AND m.sender = 'customer'
            ORDER BY created_at DESC
            LIMIT 1
         ) lm ON true
        WHERE f.status = 'pending'
          AND f.due_at <= now()
          AND c.status = 'open'
          AND NOT EXISTS (
            SELECT 1 FROM omni_suggestions s
             WHERE s.conversation_id = c.id
               AND s.approval_state = 'pending'
               AND s.metadata->>'automation_rule_id' = $1::text
          )
          AND NOT EXISTS (
            SELECT 1 FROM omni_ai_jobs j
             WHERE j.conversation_id = c.id
               AND j.job_type = 'suggest'
               AND j.status IN ('pending', 'running')
               AND j.input_json->>'automation_rule_id' = $1::text
          )
        ORDER BY f.due_at ASC
        LIMIT $2`,
      [rule.id, limit],
    );
    return rows.map((row) => ({ ...row, sequence_bucket: bucketFor(row.last_customer_at, 24) }));
  } catch (e) {
    if (e.code === "42P01" || e.code === "42703") return [];
    throw e;
  }
}

function candidatePayload(rule, row) {
  return {
    trigger_event: rule.trigger_event,
    conversation_id: row.conversation_id,
    conversation_status: row.conversation_status,
    message_id: row.message_id,
    channel: row.channel,
    requires_template: Boolean(row.requires_template),
    sequence_bucket: row.sequence_bucket,
    hours_since_last_customer_reply: row.hours_since_last_customer_reply,
    last_customer_at: row.last_customer_at,
    last_agent_at: row.last_agent_at,
    sequence: {
      bucket: row.sequence_bucket,
      hours_since_last_customer_reply: row.hours_since_last_customer_reply,
      requires_template: Boolean(row.requires_template),
    },
    message: { sender: "agent", body: "Temporal follow-up sequence" },
  };
}

export async function runSequenceTick(pool, logger) {
  const { rows: rules } = await pool.query(
    `SELECT id, name, priority, trigger_event, conditions, actions, requires_approval
       FROM omni_automation_rules
      WHERE enabled = true
        AND trigger_event IN ('conversation.no_reply', 'followup.due')
      ORDER BY priority ASC`,
  );

  let evaluated = 0;
  let matched = 0;
  for (const rule of rowsOrEmpty(rules)) {
    if (!isDraftOnlyRule(rule)) {
      logger?.warn?.({ rule_id: rule.id }, "omni sequence rule skipped: only ai_draft_followup is allowed in HITL v1");
      continue;
    }
    const candidates = rule.trigger_event === "followup.due"
      ? await findFollowupDueCandidates(pool, rule)
      : await findNoReplyCandidates(pool, rule);
    evaluated += candidates.length;
    for (const row of candidates) {
      const payload = candidatePayload(rule, row);
      const result = await runAutomationForEvent(pool, payload, {
        force: true,
        ruleId: rule.id,
        allowedActionTypes: ["ai_draft_followup"],
        skipConditions: !hasDslConditions(rule.conditions),
        triggerEvent: rule.trigger_event,
        idempotencyKey: (r) => `seq:${r.id}:${row.conversation_id}:${row.sequence_bucket}`,
      });
      matched += result.matched?.length || 0;
    }
  }
  if (matched) logger?.info?.({ evaluated, matched }, "omni sequence worker enqueued follow-up drafts");
  return { rules: rules.length, evaluated, matched };
}

function rowsOrEmpty(rows) {
  return Array.isArray(rows) ? rows : [];
}

export function startOmniSequenceWorker({ logger, pool, enabled = false, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const log = logger || { info() {}, warn() {} };
  if (!pool) return () => {};
  if (!enabled) {
    log.info("[omniSequenceWorker] disabled (OMNI_SEQUENCES_ENABLED=false)");
    return () => {};
  }
  let stopped = false;
  let running = false;

  async function tick() {
    if (stopped || running) return;
    running = true;
    try {
      await runSequenceTick(pool, log);
    } catch (e) {
      log.warn?.({ err: e?.message }, "omni sequence worker tick failed");
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
