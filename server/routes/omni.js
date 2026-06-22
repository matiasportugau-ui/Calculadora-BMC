/**
 * /api/omni/* — unified inbox API (Track D)
 */
import { Router } from "express";
import { config } from "../config.js";
import { getOmniPool, omniHealthCheck } from "../lib/omni/omniDb.js";
import { normalizeAndPersist } from "../lib/omni/normalizer.js";
import { parseOmniInboundEvent } from "../lib/omni/types.js";
import { requireGrant } from "../middleware/requireGrant.js";
import { sendWaReply } from "../lib/omni/outbound/waReply.js";
import { sendMlReply } from "../lib/omni/outbound/mlReply.js";

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
    res.status(health.ok ? 200 : 503).json({ ok: health.ok, ...health });
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
         c.updated_at,
         co.name AS contact_name,
         co.email AS contact_email,
         co.wa_phone,
         (SELECT COUNT(*)::int FROM omni_messages m WHERE m.conversation_id = c.id) AS message_count,
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
      `SELECT c.channel, c.channel_conversation_id, co.wa_phone, co.ml_user_id
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
      contact_hint: {},
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

export default router;
