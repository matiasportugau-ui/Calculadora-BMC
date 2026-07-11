/**
 * /api/omni/* — unified inbox API (Track D + WAVE 3)
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.js";
import { getOmniPool, omniHealthCheck } from "../lib/omni/omniDb.js";
import { normalizeAndPersist } from "../lib/omni/normalizer.js";
import { parseOmniInboundEvent } from "../lib/omni/types.js";
import { requireGrant } from "../middleware/requireGrant.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { sendWaReply } from "../lib/omni/outbound/waReply.js";
import { sendMlReply } from "../lib/omni/outbound/mlReply.js";
import { sendOmniEmailReply } from "../lib/omni/outbound/emailReply.js";
import { sendIgReply } from "../lib/omni/outbound/igSend.js";
import { sendMessengerReply } from "../lib/omni/outbound/messengerSend.js";
import { collectOmniMetrics, formatPrometheusMetrics } from "../lib/omni/omniMetrics.js";
import {
  runAutomationForEvent,
  simulateAutomationRule,
  ALLOWED_CONVERSATION_STATUSES,
} from "../lib/omni/orchestrator/automationEngine.js";
import { runAdHocAiJob, runAiJobById, ALLOWED_AI_JOB_TYPES, getDailyAiCost } from "../lib/omni/orchestrator/aiWorker.js";
import { listModelRegistry, listPromptRegistry, getActivePromptContract } from "../lib/omni/orchestrator/aiRegistry.js";
import { createDeal, listDeals, updateDeal } from "../lib/omni/deals/dealService.js";
import { syncDealToCrm } from "../lib/omni/deals/syncCrm.js";
import { listSuggestions, resolveSuggestion } from "../lib/omni/orchestrator/suggestions.js";
import { recordOmniPromptEval, getPromptEvalStats } from "../lib/omni/knowledge/evalFeedback.js";
import { normalizeStage } from "../lib/omni/deals/stageMachine.js";
import { buildConversationPatch, isUuid } from "../lib/omni/conversationPatch.js";
import { rankUrgentConversations } from "../lib/omni/urgency.js";
import { appendTeamIsolationFilter } from "../lib/omni/teamIsolation.js";
import { findDuplicateClusters } from "../lib/omni/identity/duplicateContacts.js";
import { mergeContacts, ContactMergeError } from "../lib/omni/identity/contactMerge.js";
import { callAgentOnce } from "../lib/agentCore.js";
import { dispatchAssistant } from "../lib/assistantRegistry.js";

const omniReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const omniWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// AI copilot actions for the inline thread assistant. Each builds a one-shot
// agentCore prompt (provider chain + budget caps apply). Thread-based actions
// read the conversation; rewrite actions operate on the operator's current draft.
const ASSIST_ACTIONS = {
  draft: {
    needsThread: true,
    system:
      "Redactás respuestas de email para BMC Uruguay (paneles de aislamiento). Español rioplatense, tono BMC, claro y concreto. Devolvé SOLO el cuerpo del email, sin asunto ni firma.",
    task: (instruction) =>
      `Redactá una respuesta al último mensaje del cliente.${instruction ? ` Instrucción del operador: ${instruction}` : " Avanzá hacia la cotización/coordinación de forma útil."}`,
  },
  summarize: {
    needsThread: true,
    system: "Resumís hilos de email para un operador. Español, conciso.",
    task: () => "Resumí este hilo en 3-5 viñetas: qué pide el cliente, estado, y la próxima acción sugerida.",
  },
  extract: {
    needsThread: true,
    system: "Extraés datos estructurados de hilos de email. Devolvé SOLO JSON válido, sin texto extra.",
    task: () =>
      'Extraé los datos clave como JSON con claves: intencion, productos, cantidades, montos, fechas, nro_pedido_o_PO, contacto. Usá null si falta un dato.',
  },
  translate: {
    needsDraft: true,
    system: "Traducís texto de email con precisión, preservando el tono. Devolvé SOLO la traducción.",
    task: (instruction) => `Traducí el siguiente texto${instruction ? ` (${instruction})` : " al inglés si está en español, o al español si está en inglés"}:`,
  },
  formal: {
    needsDraft: true,
    system: "Reescribís borradores de email. Devolvé SOLO el texto reescrito, sin comentarios.",
    task: () => "Reescribí el siguiente borrador en un tono más formal y profesional, manteniendo el contenido:",
  },
  shorter: {
    needsDraft: true,
    system: "Reescribís borradores de email. Devolvé SOLO el texto reescrito, sin comentarios.",
    task: () => "Reescribí el siguiente borrador más corto y directo, manteniendo lo esencial:",
  },
};

function requireOmniDb(req, res, next) {
  const pool = getOmniPool(config.databaseUrl);
  if (!pool) {
    return res.status(503).json({ ok: false, error: "omni_db_unavailable" });
  }
  req.omniPool = pool;
  next();
}

// Team isolation for per-conversation access. The list endpoint already scopes
// non-admins to team_id NULL OR their teams; this applies the SAME rule to
// per-conversation reads (messages/notes/assist) so a guessed UUID can't expose
// another team's thread. Returns true if the conversation is visible to req.user.
async function conversationVisibleTo(pool, conversationId, user) {
  const role = user?.role;
  if (role === "admin" || role === "superadmin") {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM omni_conversations WHERE id = $1`,
      [conversationId],
    );
    return rowCount > 0;
  }
  const { rowCount } = await pool.query(
    `SELECT 1 FROM omni_conversations c
      WHERE c.id = $1
        AND (c.team_id IS NULL
             OR c.team_id IN (SELECT team_id FROM omni_team_members WHERE user_id = $2::uuid))`,
    [conversationId, user?.id],
  );
  return rowCount > 0;
}

// Resolve the set of assignable operators (users holding a `canales` grant).
// Shared by GET /omni/assignees and the assignment-validation in PATCH.
async function listAssignableUserIds(pool) {
  const { rows } = await pool.query(
    `SELECT u.user_id FROM identity.module_grants g
       JOIN identity.users u ON u.user_id = g.user_id
      WHERE g.module = 'canales' AND g.level <> 'none'`,
  );
  return new Set(rows.map((r) => r.user_id));
}

const router = Router();

// Floor rate limit for the whole /omni/* surface — guarantees every route
// (including any added later, or any DB-access path CodeQL can trace that a
// per-route omniReadLimiter/omniWriteLimiter might miss) has at least basic
// abuse protection. Write routes still layer the stricter omniWriteLimiter
// on top; both run, the stricter one is the effective ceiling.
router.use(omniReadLimiter);

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

// Email-manager account registry (009) — powers the inbox account filter and the
// "received at" badge. Read-only list; account management is admin-only (later phase).
router.get(
  "/omni/accounts",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    try {
      const { rows } = await req.omniPool.query(
        `SELECT id, email, label, team_id, enabled, health
           FROM omni_email_accounts
          ORDER BY label NULLS LAST, email`,
      );
      res.json({ ok: true, accounts: rows });
    } catch (e) {
      // Pre-migration safety: degrade to empty rather than 500 the panel.
      res.json({ ok: true, accounts: [], degraded: e.code || "accounts_unavailable" });
    }
  },
);

// Assignable operators — users holding a `canales` grant. Powers the inbox
// assign-to-operator picker. Read-only; degrades to empty so the picker never
// breaks the panel. (identity schema lives in the same DB as the omni pool.)
router.get(
  "/omni/assignees",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    try {
      const { rows } = await req.omniPool.query(
        `SELECT u.user_id, u.email, u.name
           FROM identity.module_grants g
           JOIN identity.users u ON u.user_id = g.user_id
          WHERE g.module = 'canales' AND g.level <> 'none'
          ORDER BY u.name NULLS LAST, u.email`,
      );
      res.json({ ok: true, assignees: rows });
    } catch (e) {
      res.json({ ok: true, assignees: [], degraded: e.code || "assignees_unavailable" });
    }
  },
);

// Admin cockpit — a management rollup ON TOP of the inbox: per-mailbox health +
// volume, per-operator load, the unassigned/overdue queues, and SLA/FRT. All
// read-only aggregation; degrades to an empty snapshot pre-migration so the
// panel never hard-fails.
router.get(
  "/omni/admin/overview",
  omniReadLimiter,
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const OVERDUE_HOURS = Number(req.query.overdue_hours) || 24;
    try {
      const [totals, accounts, assignees, sla] = await Promise.all([
        // Email-channel queue totals.
        req.omniPool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'open')::int AS open_total,
             COUNT(*) FILTER (WHERE status = 'open' AND assigned_to_user_id IS NULL)::int AS unassigned_open,
             COUNT(*) FILTER (WHERE status = 'open' AND receiving_account_id IS NULL)::int AS unattributed_open,
             COUNT(*) FILTER (WHERE status = 'snoozed')::int AS snoozed_total,
             COUNT(*) FILTER (WHERE status = 'open' AND first_agent_reply_at IS NULL
                              AND created_at < now() - ($1 || ' hours')::interval)::int AS overdue_unanswered,
             COUNT(*) FILTER (WHERE status = 'closed' AND updated_at >= date_trunc('day', now()))::int AS closed_today
           FROM omni_conversations
           WHERE channel = 'email'`,
          [OVERDUE_HOURS],
        ),
        // Per-mailbox health + volume.
        req.omniPool.query(
          `SELECT a.id, a.email, a.label, a.enabled, a.health, a.health_checked_at,
                  COUNT(c.id) FILTER (WHERE c.status = 'open')::int AS open_count,
                  COUNT(c.id) FILTER (WHERE c.status = 'open' AND c.assigned_to_user_id IS NULL)::int AS unassigned_open,
                  COUNT(c.id) FILTER (WHERE c.status = 'open' AND c.first_agent_reply_at IS NULL)::int AS awaiting_reply,
                  COUNT(c.id) FILTER (WHERE c.status = 'snoozed')::int AS snoozed_count,
                  ROUND(AVG(EXTRACT(EPOCH FROM (c.first_agent_reply_at - c.created_at)) / 60.0)
                        FILTER (WHERE c.first_agent_reply_at IS NOT NULL))::int AS avg_frt_min,
                  MAX(c.updated_at) AS last_activity_at
           FROM omni_email_accounts a
           LEFT JOIN omni_conversations c ON c.receiving_account_id = a.id
           GROUP BY a.id
           ORDER BY a.enabled DESC, open_count DESC, a.email`,
        ),
        // Per-operator load (only currently-assigned, open/snoozed).
        req.omniPool.query(
          `SELECT c.assigned_to_user_id AS user_id, u.email, u.name,
                  COUNT(*) FILTER (WHERE c.status = 'open')::int AS open_count,
                  COUNT(*) FILTER (WHERE c.status = 'snoozed')::int AS snoozed_count,
                  MIN(c.assigned_at) AS oldest_assigned_at
           FROM omni_conversations c
           LEFT JOIN identity.users u ON u.user_id = c.assigned_to_user_id
           WHERE c.assigned_to_user_id IS NOT NULL AND c.status IN ('open', 'snoozed')
           GROUP BY c.assigned_to_user_id, u.email, u.name
           ORDER BY open_count DESC`,
        ),
        // SLA / first-response time across the last 30 days of email.
        req.omniPool.query(
          `SELECT
             ROUND(AVG(EXTRACT(EPOCH FROM (first_agent_reply_at - created_at)) / 60.0))::int AS avg_frt_min,
             ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (first_agent_reply_at - created_at)) / 60.0))::int AS median_frt_min,
             COUNT(*)::int AS replied_count
           FROM omni_conversations
           WHERE channel = 'email' AND first_agent_reply_at IS NOT NULL
             AND created_at >= now() - interval '30 days'`,
        ),
      ]);

      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        overdue_hours: OVERDUE_HOURS,
        totals: totals.rows[0] || {},
        accounts: accounts.rows,
        assignees: assignees.rows,
        sla: sla.rows[0] || {},
      });
    } catch (e) {
      // Pre-migration / missing columns → degrade to an empty snapshot.
      req.log?.warn?.({ err: e.message, code: e.code }, "omni admin overview degraded");
      res.json({
        ok: true,
        degraded: e.code || "overview_unavailable",
        totals: {},
        accounts: [],
        assignees: [],
        sla: {},
      });
    }
  },
);

// Contact dedup — DETECTION ONLY (Wave 6). resolveContact() already dedupes new
// inbound contacts via DB unique constraints, so this only finds PRE-EXISTING
// duplicates that arrived as separate rows on different channels and now share
// a non-unique field (email/phone). Read-only; the merge action (Wave 6b) is a
// deliberately separate, admin-gated step — see contactMerge.js.
router.get(
  "/omni/contacts/duplicates",
  omniReadLimiter,
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const SCAN_LIMIT = 5000;
    try {
      const { rows } = await req.omniPool.query(
        `SELECT co.id, co.name, co.email, co.phone, co.wa_phone, co.ml_user_id, co.created_at,
                (SELECT COUNT(*)::int FROM omni_conversations c WHERE c.contact_id = co.id) AS conversation_count
           FROM omni_contacts co
          WHERE (co.email IS NOT NULL OR co.phone IS NOT NULL OR co.wa_phone IS NOT NULL)
            -- Already-merged ("loser") contacts keep their original email/phone
            -- forever (mergeContacts() never touches them) — without this guard
            -- a resolved cluster would resurface on every scan after its merge.
            AND co.properties->>'merged_into' IS NULL
          ORDER BY co.updated_at DESC
          LIMIT $1`,
        [SCAN_LIMIT],
      );
      const clusters = findDuplicateClusters(rows);
      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        scanned: rows.length,
        scan_bounded: rows.length === SCAN_LIMIT,
        cluster_count: clusters.length,
        clusters,
      });
    } catch (e) {
      if (e?.code !== "42703" && e?.code !== "42P01") throw e;
      req.log?.warn?.({ err: e.message, code: e.code }, "omni duplicate contacts degraded");
      res.json({ ok: true, degraded: e.code, scanned: 0, scan_bounded: false, cluster_count: 0, clusters: [] });
    }
  },
);

// Contact merge — EXECUTION (Wave 6b). Repoints conversations/deals from
// merged_from_id onto merged_into_id inside a single transaction; never
// hard-deletes the loser contact (see contactMerge.js for why); every merge is
// logged to omni_contact_merge_log for audit. Admin-only — this changes which
// customer a conversation/deal history belongs to, a manual, deliberate,
// owner-approved action (never automatic, never triggered by AI).
router.post(
  "/omni/contacts/merge",
  omniWriteLimiter,
  requireGrant.admin("canales"),
  requireOmniDb,
  async (req, res) => {
    const fromId = String(req.body?.from_id || "");
    const intoId = String(req.body?.into_id || "");
    if (!isUuid(fromId) || !isUuid(intoId)) {
      return res.status(400).json({ ok: false, error: "invalid_contact_id" });
    }
    try {
      const result = await mergeContacts(req.omniPool, {
        fromId,
        intoId,
        performedByUserId: req.user?.id || null,
      });
      req.log?.info?.(
        { from: fromId, into: intoId, ...result, by: req.user?.id },
        "omni contact merge completed",
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      if (e instanceof ContactMergeError) {
        const status = e.code === "contact_not_found" ? 404 : 400;
        return res.status(status).json({ ok: false, error: e.code });
      }
      if (e?.code === "42P01") {
        // The transaction touches omni_contacts/omni_conversations/omni_deals/
        // omni_contact_merge_log — any of the four can be the missing relation
        // on a partial/older schema, so surface Postgres's own message (it
        // names the table) rather than guessing it's always migration 013.
        return res.status(503).json({
          ok: false,
          error: "omni_schema_incomplete",
          detail: `${e.message} — run npm run omni:migrate to apply pending migrations before merging contacts.`,
        });
      }
      throw e;
    }
  },
);

// Contact list — read-only unified-contacts directory for the Canales "Contactos
// Unificados" tab. Searches name/email/phone/wa_phone (case-insensitive),
// newest-updated first, with each contact's conversation count, last activity and
// the set of channels it was reached on (derived from its conversations). Excludes
// already-merged ("loser") contacts via the same properties->>'merged_into' guard
// the duplicates scan uses, and degrades to an empty list on a missing column/table
// so the panel never hard-fails pre-migration. Not team-isolated (omni_contacts has
// no team_id) — consistent with the other /omni/contacts/* routes.
router.get(
  "/omni/contacts",
  omniReadLimiter,
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const q = String(req.query.search || req.query.q || "").trim();
    const search = q ? `%${q}%` : null;
    try {
      const { rows } = await req.omniPool.query(
        `SELECT co.id, co.name, co.email, co.phone, co.wa_phone, co.ml_user_id,
                co.avatar_url, co.created_at, co.updated_at,
                (SELECT COUNT(*)::int FROM omni_conversations c WHERE c.contact_id = co.id) AS conversation_count,
                (SELECT MAX(c.updated_at) FROM omni_conversations c WHERE c.contact_id = co.id) AS last_activity_at,
                (SELECT array_agg(DISTINCT c.channel) FROM omni_conversations c WHERE c.contact_id = co.id) AS channels
           FROM omni_contacts co
          WHERE co.properties->>'merged_into' IS NULL
            AND ($1::text IS NULL
                 OR co.name ILIKE $1 OR co.email ILIKE $1
                 OR co.phone ILIKE $1 OR co.wa_phone ILIKE $1)
          ORDER BY co.updated_at DESC
          LIMIT $2 OFFSET $3`,
        [search, limit, offset],
      );
      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        count: rows.length,
        contacts: rows,
      });
    } catch (e) {
      if (e?.code !== "42703" && e?.code !== "42P01") throw e;
      req.log?.warn?.({ err: e.message, code: e.code }, "omni contacts list degraded");
      res.json({ ok: true, degraded: e.code, count: 0, contacts: [] });
    }
  },
);

// "Reply-zero" action queue — the ranked, per-conversation "act on THIS now" list
// the admin cockpit's COUNTS don't give you. Read-only aggregation across all
// channels, team-isolated, scored by the pure policy in server/lib/omni/urgency.js.
// Degrades to an empty queue pre-009 so the cockpit never hard-fails.
router.get(
  "/omni/actions/urgent",
  omniReadLimiter,
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const channel = req.query.channel ? String(req.query.channel) : null;

    const params = [];
    const filters = [
      `c.status = 'open'`,
      `(c.snoozed_until IS NULL OR c.snoozed_until <= now())`,
    ];
    if (channel) {
      params.push(channel);
      filters.push(`c.channel = $${params.length}`);
    }
    appendTeamIsolationFilter(req.user, filters, params);
    const where = `WHERE ${filters.join(" AND ")}`;

    try {
      // Bound the candidate set (freshest-aging first) so JS scoring stays cheap.
      const { rows } = await req.omniPool.query(
        `SELECT c.id, c.channel, c.subject, c.status, c.priority, c.created_at,
                c.first_agent_reply_at, c.assigned_to_user_id, c.snoozed_until,
                co.name AS contact_name, co.email AS contact_email, co.wa_phone,
                (SELECT COUNT(*)::int FROM omni_messages mu
                   WHERE mu.conversation_id = c.id AND mu.sender = 'customer' AND mu.read_at IS NULL) AS unread_count,
                (SELECT MAX(m2.created_at) FROM omni_messages m2 WHERE m2.conversation_id = c.id) AS last_message_at
         FROM omni_conversations c
         JOIN omni_contacts co ON co.id = c.contact_id
         ${where}
         ORDER BY c.created_at ASC
         LIMIT 500`,
        params,
      );
      const ranked = rankUrgentConversations(rows, { limit });
      res.json({
        ok: true,
        generated_at: new Date().toISOString(),
        count: ranked.length,
        candidates_scanned: rows.length,
        actions: ranked,
      });
    } catch (e) {
      if (e?.code !== "42703" && e?.code !== "42P01") throw e;
      req.log?.warn?.({ err: e.message, code: e.code }, "omni urgent actions degraded");
      res.json({ ok: true, degraded: e.code, actions: [], count: 0, candidates_scanned: 0 });
    }
  },
);

router.get(
  "/omni/conversations",
  omniReadLimiter,
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const channel = req.query.channel ? String(req.query.channel) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const teamId = req.query.team_id ? String(req.query.team_id) : null;
    const accountId = req.query.account_id ? String(req.query.account_id) : null;
    // assigned_to: a user UUID, or the sentinels 'me' / 'unassigned'.
    const assignedTo = req.query.assigned_to ? String(req.query.assigned_to) : null;

    // Validate UUID-typed filters up front — otherwise the `::uuid` casts below
    // throw at the DB layer and surface as a 500 on plain bad input.
    if (teamId && !isUuid(teamId)) return res.status(400).json({ ok: false, error: "invalid_team_id" });
    if (accountId && !isUuid(accountId)) return res.status(400).json({ ok: false, error: "invalid_account_id" });
    if (assignedTo && assignedTo !== "me" && assignedTo !== "unassigned" && !isUuid(assignedTo)) {
      return res.status(400).json({ ok: false, error: "invalid_assigned_to" });
    }

    // Legacy filters (channel/status) reference only pre-009 columns, so they are
    // reused verbatim by the fallback query below.
    const legacyParams = [limit, offset];
    const legacyFilters = [];
    if (channel) {
      legacyParams.push(channel);
      legacyFilters.push(`c.channel = $${legacyParams.length}`);
    }
    if (status) {
      legacyParams.push(status);
      legacyFilters.push(`c.status = $${legacyParams.length}`);
    }

    // Full filters add the email-manager (009) account/owner/team predicates.
    const params = [...legacyParams];
    const filters = [...legacyFilters];
    if (teamId) {
      params.push(teamId);
      filters.push(`c.team_id = $${params.length}::uuid`);
    }
    if (accountId) {
      params.push(accountId);
      filters.push(`c.receiving_account_id = $${params.length}::uuid`);
    }
    if (assignedTo === "unassigned") {
      filters.push(`c.assigned_to_user_id IS NULL`);
    } else if (assignedTo === "me") {
      params.push(req.user.id);
      filters.push(`c.assigned_to_user_id = $${params.length}::uuid`);
    } else if (assignedTo) {
      params.push(assignedTo);
      filters.push(`c.assigned_to_user_id = $${params.length}::uuid`);
    }

    appendTeamIsolationFilter(req.user, filters, params);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const legacyWhere = legacyFilters.length ? `WHERE ${legacyFilters.join(" AND ")}` : "";

    const baseCols = `c.id, c.contact_id, c.channel, c.channel_conversation_id, c.subject,
         c.status, c.priority, c.tags, c.updated_at,
         co.name AS contact_name, co.email AS contact_email, co.wa_phone`;
    const aggCols = `(SELECT COUNT(*)::int FROM omni_messages m WHERE m.conversation_id = c.id) AS message_count,
         (SELECT COUNT(*)::int FROM omni_messages mu
            WHERE mu.conversation_id = c.id AND mu.sender = 'customer' AND mu.read_at IS NULL) AS unread_count,
         (SELECT MAX(m2.created_at) FROM omni_messages m2 WHERE m2.conversation_id = c.id) AS last_message_at`;

    let rows;
    try {
      ({ rows } = await req.omniPool.query(
        `SELECT
         ${baseCols},
         c.receiving_account_id, c.assigned_to_user_id, c.assigned_at, c.team_id,
         c.snoozed_until, c.first_agent_reply_at,
         acc.email AS account_email, acc.label AS account_label,
         ${aggCols}
       FROM omni_conversations c
       JOIN omni_contacts co ON co.id = c.contact_id
       LEFT JOIN omni_email_accounts acc ON acc.id = c.receiving_account_id
       ${where}
       ORDER BY c.updated_at DESC
       LIMIT $1 OFFSET $2`,
        params,
      ));
    } catch (e) {
      // Pre-009 schema (column/table not migrated yet): fall back to the legacy
      // projection so the inbox keeps working until migration 009 is applied.
      if (e?.code !== "42703" && e?.code !== "42P01") throw e;
      ({ rows } = await req.omniPool.query(
        `SELECT ${baseCols}, ${aggCols}
       FROM omni_conversations c
       JOIN omni_contacts co ON co.id = c.contact_id
       ${legacyWhere}
       ORDER BY c.updated_at DESC
       LIMIT $1 OFFSET $2`,
        legacyParams,
      ));
    }

    res.json({
      ok: true,
      conversations: rows,
      pagination: { limit, offset, count: rows.length },
    });
  },
);

router.get(
  "/omni/conversations/:id/messages",
  omniReadLimiter,
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    if (!(await conversationVisibleTo(req.omniPool, conversationId, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }
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

// Inline AI copilot for a thread — draft / summarize / extract / translate /
// formal / shorter. Non-mutating (returns text the operator chooses to use).
// Each call is a real LLM spend, so it is gated `write`, enforces the shared
// daily budget (OMNI_AI_DAILY_BUDGET_USD), records its own cost, and is team-
// isolated. Sending still goes through the confirm-gated reply route.
const ASSIST_MAX_INPUT = 4000; // clamp per field to bound prompt size / cost
router.post(
  "/omni/conversations/:id/assist",
  omniWriteLimiter,
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    if (!isUuid(req.params.id)) {
      return res.status(400).json({ ok: false, error: "invalid_conversation_id" });
    }
    const action = String(req.body?.action || "").trim();
    const spec = ASSIST_ACTIONS[action];
    if (!spec) {
      return res.status(400).json({ ok: false, error: "invalid_action" });
    }
    const instruction = String(req.body?.instruction || "").trim().slice(0, ASSIST_MAX_INPUT);
    const draft = String(req.body?.draft || "").trim().slice(0, ASSIST_MAX_INPUT);
    if (spec.needsDraft && !draft) {
      return res.status(400).json({ ok: false, error: "missing_draft" });
    }

    // Team isolation: a non-team operator can't summarize/extract another team's thread.
    if (!(await conversationVisibleTo(req.omniPool, req.params.id, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }

    // Shared daily-budget gate — the same ceiling the AI worker enforces, which
    // a direct callAgentOnce would otherwise bypass.
    try {
      const dailyCost = await getDailyAiCost(req.omniPool);
      if (dailyCost >= config.omniAiDailyBudgetUsd) {
        return res.status(503).json({ ok: false, error: "assist_budget_exceeded" });
      }
    } catch (e) {
      req.log?.warn?.({ err: e.message }, "omni assist budget check failed (allowing)");
    }

    let threadText = "";
    if (spec.needsThread) {
      const { rows } = await req.omniPool.query(
        `SELECT sender, body FROM omni_messages
          WHERE conversation_id = $1
          ORDER BY created_at ASC
          LIMIT 30`,
        [req.params.id],
      );
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: "conversation_not_found" });
      }
      threadText = rows
        .map((m) => `${m.sender === "customer" ? "Cliente" : "Operador"}: ${m.body || ""}`)
        .join("\n")
        .slice(0, ASSIST_MAX_INPUT * 3);
    }

    const userContent = [
      spec.task(instruction),
      spec.needsThread ? `\n\nHilo:\n${threadText}` : "",
      spec.needsDraft ? `\n\nBorrador:\n${draft}` : "",
    ].join("");

    try {
      // Route through the assistant fallback line so the copilot always has an
      // available agent: canales handler first (Claude-preferred but with the FULL
      // provider chain — note NO top-level `provider` pin, which previously locked
      // it to Claude-only), then the enabled-only line → the always-on seam.
      const messages = [{ role: "user", content: userContent }];
      const callOpts = { channel: "email", override: { provider: "claude", maxTokens: 700 } };
      const dispatch = await dispatchAssistant("canales", messages, {
        handler: () => callAgentOnce(messages, callOpts),
        callOpts,
      });
      if (!dispatch.ok) {
        return res.status(503).json({ ok: false, error: dispatch.reason });
      }
      const out = dispatch.result;
      const result = (typeof out === "string" ? out : out?.text || out?.content || "").trim();
      if (!result) {
        return res.status(502).json({ ok: false, error: "empty_result" });
      }
      // Record the spend so it counts toward the daily budget (best-effort —
      // accounting must never fail an otherwise-successful response).
      const costUsd = typeof out === "object" ? out?.estimatedCostUsd ?? 0 : 0;
      req.omniPool
        .query(
          `INSERT INTO omni_ai_jobs (job_type, conversation_id, channel, status, cost_usd, completed_at)
           VALUES ('assist', $1, 'email', 'completed', $2, now())`,
          [req.params.id, costUsd],
        )
        .catch((e) => req.log?.warn?.({ err: e.message }, "omni assist cost record failed"));
      res.json({ ok: true, action, result });
    } catch (e) {
      req.log?.warn?.({ err: e.message, action }, "omni assist failed");
      res.status(502).json({ ok: false, error: "assist_failed" });
    }
  },
);

// Internal notes — operator-only collaboration on a conversation. NEVER sent to
// the customer (distinct from omni_messages). Reads degrade to [] pre-migration
// so the thread panel never breaks; writes 503 if the table isn't there yet.
router.get(
  "/omni/conversations/:id/notes",
  requireGrant.read("canales"),
  requireOmniDb,
  async (req, res) => {
    if (!(await conversationVisibleTo(req.omniPool, req.params.id, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }
    try {
      const { rows } = await req.omniPool.query(
        `SELECT id, author_user_id, author_label, body, created_at
           FROM omni_notes
          WHERE conversation_id = $1
          ORDER BY created_at ASC`,
        [req.params.id],
      );
      res.json({ ok: true, notes: rows });
    } catch (e) {
      res.json({ ok: true, notes: [], degraded: e.code || "notes_unavailable" });
    }
  },
);

router.post(
  "/omni/conversations/:id/notes",
  omniWriteLimiter,
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ ok: false, error: "missing_body" });
    if (!(await conversationVisibleTo(req.omniPool, req.params.id, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }
    try {
      const { rows } = await req.omniPool.query(
        `INSERT INTO omni_notes (conversation_id, author_user_id, author_label, body)
         VALUES ($1, $2, $3, $4)
         RETURNING id, author_user_id, author_label, body, created_at`,
        [
          req.params.id,
          isUuid(req.user?.id) ? req.user.id : null,
          req.user?.email || req.user?.name || null,
          body,
        ],
      );
      res.status(201).json({ ok: true, note: rows[0] });
    } catch (e) {
      if (e.code === "42P01") {
        return res.status(503).json({ ok: false, error: "notes_unavailable" });
      }
      if (e.code === "23503") {
        return res.status(404).json({ ok: false, error: "conversation_not_found" });
      }
      throw e;
    }
  },
);

router.patch(
  "/omni/conversations/:id/read",
  omniWriteLimiter,
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    if (!(await conversationVisibleTo(req.omniPool, conversationId, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }
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
  omniWriteLimiter,
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    if (!(await conversationVisibleTo(req.omniPool, conversationId, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }
    const patch = buildConversationPatch(req.body);
    if (patch.error) {
      const extra = patch.error === "invalid_status" ? { allowed: ALLOWED_CONVERSATION_STATUSES } : {};
      return res.status(400).json({ ok: false, error: patch.error, ...extra });
    }

    // Validate the assignee: only allow assigning to a real user holding a
    // `canales` grant — never an arbitrary/non-existent UUID. (Unassign = null is fine.)
    const assignField = patch.fields.find((f) => f.col === "assigned_to_user_id" && f.value);
    if (assignField) {
      try {
        const assignable = await listAssignableUserIds(req.omniPool);
        if (!assignable.has(assignField.value)) {
          return res.status(400).json({ ok: false, error: "invalid_assignee" });
        }
      } catch (e) {
        req.log?.warn?.({ err: e.message }, "omni assignee validation failed");
      }
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
       RETURNING id, channel, channel_conversation_id, subject, status, priority, tags,
                 assigned_to_user_id, assigned_at, team_id, snoozed_until, receiving_account_id, updated_at`,
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
  omniWriteLimiter,
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const conversationId = req.params.id;
    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: "missing_text" });
    }

    // Team isolation: never let an operator send a reply into another team's
    // conversation (this dispatches to the customer). Mirrors /assist, /messages.
    if (!(await conversationVisibleTo(req.omniPool, conversationId, req.user))) {
      return res.status(404).json({ ok: false, error: "conversation_not_found" });
    }

    const { rows } = await req.omniPool.query(
      `SELECT c.channel, c.contact_id, c.channel_conversation_id, c.subject, co.wa_phone, co.ml_user_id, co.email
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
    } else if (conv.channel === "email") {
      // Original Message-ID (for In-Reply-To threading) + receiving box (for the
      // From identity) were stamped on the latest inbound message at ingest.
      const { rows: lastIn } = await req.omniPool.query(
        `SELECT metadata FROM omni_messages
         WHERE conversation_id = $1 AND sender = 'customer'
         ORDER BY created_at DESC LIMIT 1`,
        [conversationId],
      );
      const meta = lastIn[0]?.metadata || {};
      const recipient = conv.email || meta.email_remitente;
      if (!recipient) {
        return res.status(400).json({ ok: false, error: "email_no_recipient" });
      }
      const baseSubject = String(conv.subject || meta.asunto || "").replace(/^\s*re:\s*/i, "").trim();
      outbound = await sendOmniEmailReply({
        config,
        to: recipient,
        subject: baseSubject ? `Re: ${baseSubject}` : "Re:",
        text,
        inReplyTo: meta.rfc_message_id || undefined,
        account: meta.account || undefined,
      });
    } else if (conv.channel === "ig" || conv.channel === "fb") {
      const { rows: lastIn } = await req.omniPool.query(
        `SELECT created_at FROM omni_messages
         WHERE conversation_id = $1 AND sender = 'customer'
         ORDER BY created_at DESC LIMIT 1`,
        [conversationId],
      );
      const args = {
        config,
        recipientId: conv.channel_conversation_id,
        text,
        lastCustomerAt: lastIn[0]?.created_at,
        tag: req.body?.tag || undefined,
      };
      outbound = conv.channel === "ig"
        ? await sendIgReply(args)
        : await sendMessengerReply(args);
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
        email: conv.email || undefined,
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

    // SLA: stamp the first agent reply time (FRT). Idempotent — COALESCE keeps the
    // first value. Best-effort: a pre-009 schema must not fail an otherwise-sent reply.
    try {
      await req.omniPool.query(
        `UPDATE omni_conversations
            SET first_agent_reply_at = COALESCE(first_agent_reply_at, now())
          WHERE id = $1`,
        [conversationId],
      );
    } catch (e) {
      req.log?.warn?.({ err: e.message }, "omni first_agent_reply_at stamp skipped");
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
  omniWriteLimiter,
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

const ALLOWED_TRIGGER_EVENTS = ["message.ingested", "conversation.no_reply", "followup.due"];

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
  "/omni/deals/:id/stage",
  requireGrant.write("canales"),
  requireOmniDb,
  async (req, res) => {
    const to = normalizeStage(req.body?.stage);
    if (!to) {
      return res.status(400).json({ ok: false, error: "invalid_stage", to: req.body?.stage ?? null });
    }
    const result = await updateDeal(req.omniPool, req.params.id, { stage: to });
    if (!result.ok) {
      const status = result.error === "deal_not_found" ? 404 : result.error === "invalid_stage_transition" ? 409 : 400;
      return res.status(status).json(result);
    }
    const sync = await syncDealToCrm(result.deal);
    res.json({ ok: true, deal: result.deal, sync });
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
