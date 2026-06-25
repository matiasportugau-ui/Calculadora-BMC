/**
 * /api/omni/* — unified inbox API (Track D + WAVE 3)
 */
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getOmniPool, omniHealthCheck } from "../lib/omni/omniDb.js";
import { normalizeAndPersist } from "../lib/omni/normalizer.js";
import { parseOmniInboundEvent } from "../lib/omni/types.js";
import { requireGrant } from "../middleware/requireGrant.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { sendWaReply } from "../lib/omni/outbound/waReply.js";
import { sendMlReply } from "../lib/omni/outbound/mlReply.js";
import { collectOmniMetrics, formatPrometheusMetrics } from "../lib/omni/omniMetrics.js";
import {
  runAutomationForEvent,
  simulateAutomationRule,
  ALLOWED_CONVERSATION_STATUSES,
} from "../lib/omni/orchestrator/automationEngine.js";
import { runAdHocAiJob, runAiJobById, ALLOWED_AI_JOB_TYPES } from "../lib/omni/orchestrator/aiWorker.js";
import { listModelRegistry, listPromptRegistry, getActivePromptContract } from "../lib/omni/orchestrator/aiRegistry.js";
import { createDeal, listDeals, updateDeal } from "../lib/omni/deals/dealService.js";
import { syncDealToCrm } from "../lib/omni/deals/syncCrm.js";
import { listSuggestions, resolveSuggestion } from "../lib/omni/orchestrator/suggestions.js";
import { recordOmniPromptEval, getPromptEvalStats } from "../lib/omni/knowledge/evalFeedback.js";
import { normalizeStage } from "../lib/omni/deals/stageMachine.js";
import { buildConversationPatch } from "../lib/omni/conversationPatch.js";

function requireOmniDb(req, res, next) {
  const pool = getOmniPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "omni_db_unavailable" });
  }
  req.omniPool = pool;
  next();
}

const router = Router();

router.get("/omni/health", requireOmniDb, async (req, res) => {
  try {
    const health = await omniHealthCheck(req.omniPool);
    // Public probe: expose only liveness + version. Table-existence flags
    // (has_contacts/has_dedup) are schema reconnaissance — keep them out.
    res.status(health.ok ? 200 : 503).json({ ok: health.ok, schema_version: health.schema_version });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

router.get(
  "/omni/conversations",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const channel = req.query.channel ? String(req.query.channel) : null;
    const status = req.query.status ? String(req.query.status) : null;

    const params = [limit, offset];
    const filters = [];
    if (channel) {
      params.push(channel);
      filters.push(`c.channel = $${params.length}`);
    }
    if (status) {
      params.push(status);
      filters.push(`c.status = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await req.omniPool.query(
      `SELECT
         c.id,
         c.contact_id,
         c.channel,
         c.channel_conversation_id,
         c.subject,
         c.status,
         c.priority,
         c.tags,
         c.updated_at,
         co.name AS contact_name,
         co.email AS contact_email,
         co.wa_phone,
         (SELECT COUNT(*)::int FROM omni_messages m WHERE m.conversation_id = c.id) AS message_count,
         (SELECT COUNT(*)::int FROM omni_messages mu
            WHERE mu.conversation_id = c.id AND mu.sender = 'customer' AND mu.read_at IS NULL) AS unread_count,
         (SELECT MAX(m2.created_at) FROM omni_messages m2 WHERE m2.conversation_id = c.id) AS last_message_at
       FROM omni_conversations c
       JOIN omni_contacts co ON co.id = c.contact_id
       ${where}
       ORDER BY c.updated_at DESC
       LIMIT $1 OFFSET $2`,
      params,
    );

    res.json({
      ok: true,
      conversations: rows,
      pagination: { limit, offset, count: rows.length },
    });
  },
);

router.get(
  "/omni/conversations/:id/messages",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const { rows: convRows } = await req.omniPool.query(
      `SELECT c.*, co.name AS contact_name, co.email, co.wa_phone, co.ml_user_id
       FROM omni_conversations c
       JOIN omni_contacts co ON co.id = c.contact_id
       WHERE c.id = $1`,
      [conversationId],
    );
    if (!convRows[0]) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }

    const { rows: messages } = await req.omniPool.query(
      `SELECT id, sender, sender_id, body, attachments, metadata, read_at, created_at
       FROM omni_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [conversationId, limit],
    );

    res.json({
      ok: true,
      conversation: convRows[0],
      messages,
    });
  },
);

router.patch(
  "/omni/conversations/:id/read",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    const { rowCount } = await req.omniPool.query(
      `UPDATE omni_messages SET read_at = COALESCE(read_at, now())
       WHERE conversation_id = $1 AND sender = 'customer' AND read_at IS NULL`,
      [conversationId],
    );
    res.json({ ok: true, marked: rowCount });
  },
);

// Operator-facing conversation update (Chatwoot-style Resolve/Snooze + labels).
// Reuses the same columns/validation the automation engine writes to, but as an
// explicit REST action. `tags` is a full replace (not a merge) so the UI can add
// AND remove labels; `status` is validated against the engine's allow-list.
router.patch(
  "/omni/conversations/:id",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    const patch = buildConversationPatch(req.body);
    if (patch.error) {
      const extra = patch.error === "invalid_status" ? { allowed: ALLOWED_CONVERSATION_STATUSES } : {};
      return res.status(400).json({ ok: false, error: patch.error, ...extra });
    }

    const params = [conversationId];
    const sets = patch.fields.map((f) => {
      params.push(f.value);
      return `${f.col} = $${params.length}${f.cast ? `::${f.cast}` : ""}`;
    });

    const { rows } = await req.omniPool.query(
      `UPDATE omni_conversations
         SET ${sets.join(", ")}, updated_at = now()
       WHERE id = $1
       RETURNING id, channel, channel_conversation_id, subject, status, priority, tags, updated_at`,
      params,
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }
    res.json({ ok: true, conversation: rows[0] });
  },
);

router.post(
  "/omni/conversations/:id/reply",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: "missing_text" });
    }

    const { rows } = await req.omniPool.query(
      `SELECT c.channel, c.contact_id, c.channel_conversation_id, co.wa_phone, co.ml_user_id
       FROM omni_conversations c
       JOIN omni_contacts co ON co.id = c.contact_id
       WHERE c.id = $1`,
      [conversationId],
    );
    const conv = rows[0];
    if (!conv) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }

    let outbound = null;
    if (conv.channel === "wa") {
      const phone = conv.wa_phone || conv.channel_conversation_id;
      outbound = await sendWaReply({ config, toPhone: phone, text });
    } else if (conv.channel === "ml") {
      outbound = await sendMlReply({
        config,
        questionId: conv.channel_conversation_id,
        text,
      });
    } else {
      return res.status(400).json({ ok: false, error: "reply_not_supported_for_channel" });
    }

    if (!outbound?.ok) {
      return res.status(502).json({ ok: false, error: outbound?.error || "outbound_failed", details: outbound });
    }

    const agentId = req.user?.email || req.user?.id || "omni_api";
    const persistBody = {
      source: "manual",
      channel: conv.channel,
      idempotency_key: `${conv.channel}:reply:${conversationId}:${Date.now()}`,
      occurred_at: new Date().toISOString(),
      contact_hint: {
        contact_id: conv.contact_id,
        wa_phone: conv.wa_phone || undefined,
        ml_user_id: conv.ml_user_id ?? undefined,
      },
      conversation_hint: { channel_conversation_id: conv.channel_conversation_id },
      message: {
        sender: "agent",
        sender_id: agentId,
        body: text,
        metadata: { outbound: true, via: "omni_reply_api" },
      },
    };

    let persisted = null;
    try {
      persisted = await normalizeAndPersist(persistBody, {
        databaseUrl: config.databaseUrl,
      });
    } catch (e) {
      req.log?.warn?.({ err: e.message }, "omni reply persist failed after outbound ok");
    }

    res.json({
      ok: true,
      outbound,
      message_id: persisted?.message_id ?? null,
    });
  },
);

/** Internal ingest for tests / manual replay */
router.post(
  "/omni/ingest",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const parsed = parseOmniInboundEvent(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "validation_failed", details: parsed.error.flatten() });
    }
    try {
      const result = await normalizeAndPersist(parsed.data, { databaseUrl: config.databaseUrl });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  },
);

router.get(
  "/omni/metrics",
  requireServiceOrUser({ module: "canales", minLevel: "read" }),
  requireOmniDb,
  async (req, res) => {
    try {
      const data = await collectOmniMetrics(req.omniPool);
      if (!data.ok) {
        return res.status(503).json(data);
      }
      if (req.query.format === "prometheus") {
        res.setHeader("Content-Type", "text/plain; version=0.0.4");
        return res.send(formatPrometheusMetrics(data));
      }
      res.json(data);
    } catch (e) {
      res.status(503).json({ ok: false, error: e.message });
    }
  },
);

// Single source of truth for automation trigger events. The engine only
// evaluates "message.ingested" today (automationEngine.js); reject anything
// else at creation time so malformed rules can't persist.
const ALLOWED_TRIGGER_EVENTS = ["message.ingested"];

const automationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  trigger_event: z.enum(ALLOWED_TRIGGER_EVENTS),
  conditions: z.record(z.unknown()).default({}),
  actions: z.array(z.record(z.unknown())).default([]),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
});

router.get(
  "/omni/automation/rules",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const { rows } = await req.omniPool.query(
      `SELECT id, name, version, enabled, priority, trigger_event, conditions, actions,
              requires_approval, created_at, updated_at
       FROM omni_automation_rules ORDER BY priority ASC, created_at DESC`,
    );
    res.json({ ok: true, rules: rows });
  },
);

router.post(
  "/omni/automation/rules",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    if (!config.omniAutomationEnabled) {
      return res.status(503).json({ ok: false, error: "omni_automation_disabled" });
    }
    const parsed = automationRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "validation_failed", details: parsed.error.flatten() });
    }
    const b = parsed.data;
    const { rows } = await req.omniPool.query(
      `INSERT INTO omni_automation_rules
         (name, trigger_event, conditions, actions, priority, enabled, requires_approval, created_by)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
       RETURNING *`,
      [
        b.name,
        b.trigger_event,
        JSON.stringify(b.conditions),
        JSON.stringify(b.actions),
        b.priority ?? 100,
        b.enabled ?? true,
        b.requires_approval ?? false,
        req.user?.email || req.user?.id || "api",
      ],
    );
    res.status(201).json({ ok: true, rule: rows[0] });
  },
);

router.patch(
  "/omni/automation/rules/:id",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const { enabled, priority } = req.body || {};
    const { rows } = await req.omniPool.query(
      `UPDATE omni_automation_rules SET
         enabled = COALESCE($2, enabled),
         priority = COALESCE($3, priority),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, enabled, priority],
    );
    if (!rows[0]) return res.status(404).json({ ok: false, error: "rule_not_found" });
    res.json({ ok: true, rule: rows[0] });
  },
);

router.post(
  "/omni/automation/simulate",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const ruleId = req.body?.rule_id;
    const sampleEvent = req.body?.sample_event;
    if (!ruleId || !sampleEvent) {
      return res.status(400).json({ ok: false, error: "missing_rule_id_or_sample_event" });
    }
    const result = await simulateAutomationRule(req.omniPool, ruleId, sampleEvent);
    res.json(result);
  },
);

router.get(
  "/omni/ai/registry/prompts",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const rows = await listPromptRegistry(req.omniPool);
    res.json({ ok: true, prompts: rows });
  },
);

router.get(
  "/omni/ai/registry/models",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const rows = await listModelRegistry(req.omniPool);
    res.json({ ok: true, models: rows });
  },
);

/** Internal AI connector (E4) — service token or admin */
router.post(
  "/internal/omni/ai/run",
  requireServiceOrUser({ module: "canales", minLevel: "write" }),
  requireOmniDb,
  async (req, res) => {
    if (!config.omniAiOrchestratorEnabled) {
      return res.status(503).json({ ok: false, error: "omni_ai_orchestrator_disabled" });
    }
    const jobType = String(req.body?.job_type || "classify");
    const messageId = req.body?.message_id;
    const conversationId = req.body?.conversation_id;
    const channel = req.body?.channel;

    if (!ALLOWED_AI_JOB_TYPES.includes(jobType)) {
      return res.status(400).json({ ok: false, error: "invalid_job_type" });
    }

    if (req.body?.job_id) {
      const result = await runAiJobById(req.omniPool, req.body.job_id, { logger: req.log });
      return res.status(result.ok ? 200 : 400).json(result);
    }

    if (!messageId || !conversationId) {
      return res.status(400).json({ ok: false, error: "missing_message_or_conversation_id" });
    }

    const result = await runAdHocAiJob(
      req.omniPool,
      {
        job_type: jobType,
        message_id: messageId,
        conversation_id: conversationId,
        channel,
        input_json: req.body?.context || {},
      },
      req.log,
    );
    res.status(result.ok ? 200 : 400).json(result);
  },
);

router.get(
  "/internal/omni/prompts/:taskKey/active",
  requireServiceOrUser({ module: "canales", minLevel: "read" }),
  requireOmniDb,
  async (req, res) => {
    const channel = req.query.channel ? String(req.query.channel) : null;
    const contract = await getActivePromptContract(req.omniPool, req.params.taskKey, channel);
    res.json({ ok: true, ...contract });
  },
);

router.get(
  "/omni/deals",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const deals = await listDeals(req.omniPool, req.query);
    res.json({ ok: true, deals });
  },
);

router.post(
  "/omni/deals",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const { contact_id, title, value_usd, stage, source_channel, source_conversation_id } = req.body || {};
    if (!contact_id || !title) {
      return res.status(400).json({ ok: false, error: "missing_contact_id_or_title" });
    }
    const normalized = normalizeStage(stage);
    if (stage != null && !normalized) {
      return res.status(400).json({ ok: false, error: "invalid_stage" });
    }
    const deal = await createDeal(req.omniPool, {
      contact_id,
      title,
      value_usd,
      stage: normalized,
      source_channel,
      source_conversation_id,
      owner_agent_id: req.user?.email || req.user?.id || null,
      properties: req.body?.properties || {},
    });
    res.status(201).json({ ok: true, deal });
  },
);

router.patch(
  "/omni/deals/:id",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const result = await updateDeal(req.omniPool, req.params.id, req.body || {});
    if (!result.ok) {
      return res.status(result.error === "deal_not_found" ? 404 : 400).json(result);
    }
    let sync = null;
    if (config.omniDealsSheetsAuthority === false || req.body?.sync_crm) {
      sync = await syncDealToCrm(result.deal);
    }
    res.json({ ok: true, deal: result.deal, sync });
  },
);

router.get(
  "/omni/suggestions",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const suggestions = await listSuggestions(req.omniPool, req.query);
    res.json({ ok: true, suggestions });
  },
);

router.post(
  "/omni/suggestions/:id/accept",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const result = await resolveSuggestion(req.omniPool, req.params.id, "accept", {
      actor: req.user?.email || req.user?.id,
    });
    if (!result.ok) return res.status(404).json(result);

    const meta = result.suggestion.metadata || {};
    await recordOmniPromptEval(req.omniPool, {
      task_key: "suggest",
      prompt_version: meta.prompt_version ?? 1,
      suggestion_id: result.suggestion.id,
      rating: "accepted",
      channel: result.suggestion.channel,
      question: req.body?.question,
      generated_text: result.suggestion.body,
      conversation_id: result.suggestion.conversation_id,
      metadata: { actor: result.actor },
    }).catch(() => {});

    res.json(result);
  },
);

router.post(
  "/omni/suggestions/:id/reject",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const result = await resolveSuggestion(req.omniPool, req.params.id, "reject", {
      actor: req.user?.email || req.user?.id,
    });
    if (!result.ok) return res.status(404).json(result);

    const meta = result.suggestion.metadata || {};
    await recordOmniPromptEval(req.omniPool, {
      task_key: "suggest",
      prompt_version: meta.prompt_version ?? 1,
      suggestion_id: result.suggestion.id,
      rating: "rejected",
      channel: result.suggestion.channel,
      question: req.body?.question,
      generated_text: result.suggestion.body,
      conversation_id: result.suggestion.conversation_id,
      metadata: { actor: result.actor },
    }).catch(() => {});

    res.json(result);
  },
);

router.get(
  "/omni/ai/eval",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const stats = await getPromptEvalStats(req.omniPool, req.query.task_key || "suggest");
    res.json({ ok: true, stats });
  },
);

export default router;
