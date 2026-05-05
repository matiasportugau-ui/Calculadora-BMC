/**
 * WA Cockpit — rutas /api/wa/* (montar con app.use("/api", router)).
 *
 * F1: ingest, conversations, messages, health.
 * F2-F5 endpoints se agregan en sus fases (suggestions, outbound, metrics, heartbeat, etc.).
 *
 * Auth: Bearer / X-Api-Key contra config.apiAuthToken (mismo token que /api/crm/cockpit/*).
 * Storage: Postgres `wa_*` (mismo DATABASE_URL que Transportista).
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../lib/waDb.js";
import { validateIngestBatch, validateIngestMessage } from "../lib/waValidate.js";
import { classifyIntent, generateSuggestions } from "../lib/waEnricher.js";
import { runWaQuote } from "../lib/waQuoteRunner.js";
import { sendWhatsAppText } from "../lib/whatsappOutbound.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireWaAuth(config) {
  return (req, res, next) => {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({
        ok: false,
        error: "API_AUTH_TOKEN not configured — wa cockpit disabled",
      });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) {
      // F5 multi-operador: leemos X-Operator-Id (opcional) y lo dejamos en req
      // para attribution. Si no viene, queda como null.
      const opId = String(req.headers["x-operator-id"] || "").slice(0, 64).trim();
      req.waOperatorId = opId || null;
      return next();
    }
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

/**
 * Recompute last_msg_at / last_msg_in_at / last_msg_out_at after a batch insert.
 * Cheaper than computing per-row in SQL trigger; one query per chat.
 */
async function recomputeConversationCursors(client, chatIds) {
  if (!chatIds.length) return;
  await client.query(
    `update wa_conversations c
       set last_msg_at = m.last_at,
           last_msg_in_at = m.last_in_at,
           last_msg_out_at = m.last_out_at,
           updated_at = now()
     from (
       select chat_id,
              max(ts) as last_at,
              max(ts) filter (where direction = 'in') as last_in_at,
              max(ts) filter (where direction = 'out') as last_out_at
       from wa_messages
       where chat_id = any($1::text[])
       group by chat_id
     ) m
     where c.chat_id = m.chat_id`,
    [chatIds],
  );
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createWaRouter(config, logger) {
  const router = Router();
  const pool = getWaPool(config.databaseUrl);
  const log = logger || console;
  const auth = requireWaAuth(config);

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  // F5 — rate-limit por chat_id en outbound (no parecer bot)
  const outboundLimit = Math.max(1, Number(config.waOutboundRateLimitPerMin || 6));
  const outboundLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: outboundLimit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const cid = String(req.body?.chat_id || "").trim() || "no-chat";
      const op = req.waOperatorId || "no-op";
      return `${cid}|${op}`;
    },
    message: { ok: false, error: "rate_limited", limit_per_min: outboundLimit },
  });

  // ── Health ──────────────────────────────────────────────────────────────
  router.get(
    "/wa/health",
    asyncHandler(async (_req, res) => {
      if (!pool) {
        return res.status(503).json({ ok: false, db: false, error: "DATABASE_URL not configured" });
      }
      try {
        await pool.query("select 1");
        const { rows: [c] } = await pool.query("select count(*)::int as n from wa_conversations");
        const { rows: [m] } = await pool.query(
          "select count(*)::int as n from wa_messages where ts > now() - interval '24 hours'",
        );
        return res.json({
          ok: true,
          db: true,
          count_chats: c?.n ?? 0,
          count_msgs_24h: m?.n ?? 0,
          module: "wa-cockpit",
        });
      } catch (e) {
        return res.status(503).json({ ok: false, db: false, error: e.message });
      }
    }),
  );

  // ── Ingest (batch idempotente) ──────────────────────────────────────────
  router.post(
    "/wa/ingest",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const v = validateIngestBatch(req.body);
      if (!v.ok) {
        return res.status(400).json({ ok: false, error: "validation_failed", details: v.errors });
      }

      const valid = [];
      const rejected = [];
      for (const raw of v.messages) {
        const r = validateIngestMessage(raw);
        if (r.valid) valid.push(r.normalized);
        else rejected.push({ msg_id: raw?.msg_id || null, errors: r.errors });
      }

      if (!valid.length) {
        return res.status(400).json({
          ok: false,
          error: "no_valid_messages",
          inserted: 0,
          rejected_count: rejected.length,
          rejected,
        });
      }

      const chatIds = [...new Set(valid.map((m) => m.chat_id))];

      const client = await pool.connect();
      let insertedMessages = 0;
      let upsertedConversations = 0;
      try {
        await client.query("BEGIN");

        // Upsert conversations (one per unique chat_id; phone/contact_name come from any in-direction msg)
        for (const chatId of chatIds) {
          const sample = valid.find((m) => m.chat_id === chatId && m.direction === "in") ||
            valid.find((m) => m.chat_id === chatId);
          await client.query(
            `insert into wa_conversations (chat_id, phone, contact_name)
             values ($1, $2, $3)
             on conflict (chat_id) do update
               set phone = coalesce(wa_conversations.phone, excluded.phone),
                   contact_name = coalesce(wa_conversations.contact_name, excluded.contact_name),
                   updated_at = now()`,
            [chatId, sample?.phone || null, sample?.contact_name || null],
          );
          upsertedConversations += 1;
        }

        // Insert messages — idempotent by msg_id
        for (const m of valid) {
          const r = await client.query(
            `insert into wa_messages
               (msg_id, chat_id, ts, direction, type, text, reply_to, source, status, raw, meta, created_by)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
             on conflict (msg_id) do nothing`,
            [
              m.msg_id,
              m.chat_id,
              m.ts,
              m.direction,
              m.type,
              m.text,
              m.reply_to,
              m.source,
              m.status,
              JSON.stringify(m.raw || {}),
              JSON.stringify(m.meta || {}),
              v.operator_id || req.waOperatorId || null,
            ],
          );
          if (r.rowCount > 0) insertedMessages += 1;
        }

        await recomputeConversationCursors(client, chatIds);

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        log.error?.({ err: e?.message }, "wa/ingest failed");
        return res.status(500).json({ ok: false, error: "ingest_failed", detail: e?.message });
      } finally {
        client.release();
      }

      return res.json({
        ok: true,
        inserted: insertedMessages,
        deduped: valid.length - insertedMessages,
        chats_touched: upsertedConversations,
        rejected_count: rejected.length,
        rejected: rejected.slice(0, 20),
        live: v.live,
        operator_id: v.operator_id,
        batch_id: v.batch_id,
      });
    }),
  );

  // ── List conversations ──────────────────────────────────────────────────
  router.get(
    "/wa/conversations",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const status = req.query.status ? String(req.query.status).slice(0, 32) : "";
      const q = req.query.q ? String(req.query.q).slice(0, 64) : "";
      const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
      const cursor = req.query.cursor ? String(req.query.cursor) : "";

      const where = [];
      const params = [];
      let idx = 1;

      if (status === "stale_24h") {
        where.push(`(c.last_msg_in_at is not null and c.last_msg_in_at > coalesce(c.last_msg_out_at, '1970-01-01') and c.last_msg_in_at < now() - interval '24 hours')`);
      } else if (status) {
        where.push(`c.status = $${idx++}`);
        params.push(status);
      }

      if (q) {
        where.push(`(c.contact_name ilike $${idx} or c.phone ilike $${idx} or c.chat_id ilike $${idx})`);
        params.push(`%${q}%`);
        idx += 1;
      }

      if (cursor) {
        where.push(`c.last_msg_at < $${idx++}`);
        params.push(cursor);
      }

      const sql = `
        select chat_id, phone, contact_name, last_msg_at, last_msg_in_at, last_msg_out_at,
               status, intent_last, owner_op, lead_sheet_row, unread_count, meta, created_at, updated_at
        from wa_conversations c
        ${where.length ? "where " + where.join(" and ") : ""}
        order by c.last_msg_at desc nulls last
        limit ${limit + 1}
      `;
      const { rows } = await pool.query(sql, params);
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore && items[items.length - 1]?.last_msg_at
        ? new Date(items[items.length - 1].last_msg_at).toISOString()
        : null;

      return res.json({ ok: true, count: items.length, next_cursor: nextCursor, items });
    }),
  );

  // ── Get messages for a chat ─────────────────────────────────────────────
  router.get(
    "/wa/messages",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.query.chat_id || "").trim();
      if (!chatId) {
        return res.status(400).json({ ok: false, error: "chat_id required" });
      }
      const before = req.query.before ? String(req.query.before) : null;
      const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);

      const params = [chatId];
      let idx = 2;
      let where = "chat_id = $1";
      if (before) {
        where += ` and ts < $${idx++}`;
        params.push(before);
      }

      const { rows } = await pool.query(
        `select msg_id, chat_id, ts, direction, type, text, reply_to, source, status, meta
         from wa_messages
         where ${where}
         order by ts desc
         limit ${limit + 1}`,
        params,
      );
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextBefore = hasMore && items[items.length - 1]?.ts
        ? new Date(items[items.length - 1].ts).toISOString()
        : null;

      return res.json({
        ok: true,
        chat_id: chatId,
        count: items.length,
        next_before: nextBefore,
        items: items.reverse(),
      });
    }),
  );

  // ── F2 — Suggestions: list per chat ─────────────────────────────────────
  router.get(
    "/wa/suggestions",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.query.chat_id || "").trim();
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
      const onlyPending = req.query.pending === "1" || req.query.pending === "true";

      const where = ["chat_id = $1"];
      const params = [chatId];
      if (onlyPending) where.push("chosen_idx is null");

      const { rows } = await pool.query(
        `select id, chat_id, trigger_msg_id, generated_at, intent, options,
                chosen_idx, chosen_at, sent_msg_id, provider, latency_ms, error, meta
         from wa_suggestions
         where ${where.join(" and ")}
         order by generated_at desc
         limit ${limit}`,
        params,
      );

      return res.json({ ok: true, count: rows.length, items: rows });
    }),
  );

  // ── F2 — Suggestion: mark chosen (operator picked an option) ────────────
  router.post(
    "/wa/suggestions/:id/chosen",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || "").trim();
      const chosenIdx = Number(req.body?.chosen_idx);
      const sentMsgId = req.body?.sent_msg_id ? String(req.body.sent_msg_id).slice(0, 256) : null;

      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ ok: false, error: "invalid id" });
      }
      if (!Number.isFinite(chosenIdx) || chosenIdx < 0 || chosenIdx > 10) {
        return res.status(400).json({ ok: false, error: "chosen_idx must be 0..10" });
      }

      const r = await pool.query(
        `update wa_suggestions
           set chosen_idx = $2,
               chosen_at = now(),
               sent_msg_id = coalesce($3, sent_msg_id)
         where id = $1::uuid
         returning id, chat_id, chosen_idx, chosen_at, sent_msg_id`,
        [id, chosenIdx, sentMsgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, error: "not found" });
      return res.json({ ok: true, suggestion: r.rows[0] });
    }),
  );

  // ── F3 — Quotes: list per chat ──────────────────────────────────────────
  router.get(
    "/wa/quotes",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.query.chat_id || "").trim();
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
      const { rows } = await pool.query(
        `select quote_id, chat_id, trigger_msg_id, generated_at, generated_by_ai,
                params, total_usd, total_iva_usd, bom_summary, link, status, sheet_row, meta
         from wa_quotes
         where chat_id = $1
         order by generated_at desc
         limit ${limit}`,
        [chatId],
      );
      return res.json({ ok: true, count: rows.length, items: rows });
    }),
  );

  // ── F3 — Quotes: run on-demand (operator override params) ───────────────
  router.post(
    "/wa/quotes/run",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.body?.chat_id || "").trim();
      const triggerMsgId = req.body?.trigger_msg_id ? String(req.body.trigger_msg_id) : null;
      const forceParams = req.body?.params || null;
      const text = req.body?.text ? String(req.body.text) : null;
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      if (!forceParams && !text) {
        return res.status(400).json({ ok: false, error: "params or text required" });
      }

      const r = await runWaQuote({
        pool,
        chatId,
        text,
        triggerMsgId,
        generatedByAi: false,
        forceParams,
      });
      if (!r.ok) {
        return res.status(400).json({ ok: false, ...r });
      }
      return res.json({ ok: true, quote: r.quote });
    }),
  );

  // ── F3 — Conversations: upsert lead → CRM_Operativo ────────────────────
  router.post(
    "/wa/conversations/:chat_id/upsert-lead",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.params.chat_id || "").trim();
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      const sheetRow = req.body?.sheet_row != null ? Number(req.body.sheet_row) : null;
      const ownerOp = req.body?.owner_op ? String(req.body.owner_op).slice(0, 64) : null;

      // Carga el conversation actual
      const { rows: existing } = await pool.query(
        `select chat_id, phone, contact_name, lead_sheet_row, owner_op
         from wa_conversations where chat_id = $1`,
        [chatId],
      );
      if (existing.length === 0) {
        return res.status(404).json({ ok: false, error: "conversation not found" });
      }

      // F3 inicial: el match por phone contra CRM_Operativo se hace desde el SPA con
      // /api/crm/cockpit/* (cliente sabe qué fila editar). Acá sólo persistimos sheet_row
      // y owner_op contra la conversation. La sincronización col AH se dispara desde
      // la UI con un POST /api/crm/cockpit/quote-link manual o desde F4.
      const updateFields = [];
      const params = [chatId];
      let idx = 2;
      if (sheetRow != null && Number.isFinite(sheetRow) && sheetRow > 0) {
        updateFields.push(`lead_sheet_row = $${idx++}`);
        params.push(sheetRow);
      }
      if (ownerOp) {
        updateFields.push(`owner_op = $${idx++}`);
        params.push(ownerOp);
      }
      if (updateFields.length === 0) {
        return res.status(400).json({ ok: false, error: "nothing to update (provide sheet_row or owner_op)" });
      }

      const { rows } = await pool.query(
        `update wa_conversations
            set ${updateFields.join(", ")},
                updated_at = now()
          where chat_id = $1
          returning chat_id, phone, contact_name, lead_sheet_row, owner_op, status, intent_last`,
        params,
      );

      return res.json({ ok: true, conversation: rows[0] });
    }),
  );

  // ── F4 — Follow-ups: list, create, mark done ────────────────────────────
  router.get(
    "/wa/followups",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = req.query.chat_id ? String(req.query.chat_id).trim() : "";
      const status = req.query.status ? String(req.query.status).trim() : "pending";
      const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
      const where = ["status = $1"];
      const params = [status];
      let idx = 2;
      if (chatId) {
        where.push(`chat_id = $${idx++}`);
        params.push(chatId);
      }
      const dueOnly = req.query.due === "1" || req.query.due === "true";
      if (dueOnly) where.push(`due_at <= now()`);

      const { rows } = await pool.query(
        `select id, chat_id, due_at, kind, status, note, meta, created_at, done_at
         from wa_followups
         where ${where.join(" and ")}
         order by due_at asc
         limit ${limit}`,
        params,
      );
      return res.json({ ok: true, count: rows.length, items: rows });
    }),
  );

  router.post(
    "/wa/followups",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.body?.chat_id || "").trim();
      const kind = String(req.body?.kind || "manual").slice(0, 32);
      const dueAt = req.body?.due_at ? new Date(req.body.due_at) : null;
      const note = req.body?.note ? String(req.body.note).slice(0, 1000) : null;
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      if (!dueAt || Number.isNaN(dueAt.getTime())) {
        return res.status(400).json({ ok: false, error: "due_at must be a valid date" });
      }
      const ins = await pool.query(
        `insert into wa_followups (chat_id, due_at, kind, note)
         values ($1, $2::timestamptz, $3, $4)
         returning id, chat_id, due_at, kind, status, note, created_at`,
        [chatId, dueAt.toISOString(), kind, note],
      );
      return res.status(201).json({ ok: true, item: ins.rows[0] });
    }),
  );

  router.patch(
    "/wa/followups/:id",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ ok: false, error: "invalid id" });
      const status = req.body?.status ? String(req.body.status).slice(0, 16) : null;
      if (!["done", "cancelled", "pending"].includes(status)) {
        return res.status(400).json({ ok: false, error: "status must be done|cancelled|pending" });
      }
      const r = await pool.query(
        `update wa_followups
            set status = $2,
                done_at = case when $2 = 'done' then now() else done_at end
          where id = $1::uuid
          returning id, status, done_at`,
        [id, status],
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, error: "not found" });
      return res.json({ ok: true, item: r.rows[0] });
    }),
  );

  // ── F4 — Consent (Cloud API outbound opt-in) ────────────────────────────
  router.post(
    "/wa/conversations/:chat_id/consent",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.params.chat_id || "").trim();
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      const granted = Boolean(req.body?.granted);
      const source = req.body?.source ? String(req.body.source).slice(0, 64) : "cockpit_ui";
      const r = await pool.query(
        `update wa_conversations
            set consent_at = case when $2 then now() else null end,
                consent_source = case when $2 then $3 else null end,
                updated_at = now()
          where chat_id = $1
          returning chat_id, consent_at, consent_source`,
        [chatId, granted, source],
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, error: "not found" });
      return res.json({ ok: true, conversation: r.rows[0] });
    }),
  );

  // ── F4 — Outbound: paste_back register OR cloud_api send ────────────────
  router.post(
    "/wa/outbound",
    auth,
    requireDb,
    outboundLimiter,
    asyncHandler(async (req, res) => {
      const chatId = String(req.body?.chat_id || "").trim();
      const text = String(req.body?.text || "").trim();
      const kind = String(req.body?.kind || "paste_back").trim();
      const suggestionId = req.body?.suggestion_id ? String(req.body.suggestion_id) : null;
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });
      if (!text) return res.status(400).json({ ok: false, error: "text required" });
      if (!["paste_back", "cloud_api"].includes(kind)) {
        return res.status(400).json({ ok: false, error: "kind must be paste_back|cloud_api" });
      }

      const conv = await pool.query(
        `select chat_id, phone, consent_at from wa_conversations where chat_id = $1`,
        [chatId],
      );
      if (conv.rowCount === 0) return res.status(404).json({ ok: false, error: "conversation not found" });
      const row = conv.rows[0];

      if (kind === "cloud_api") {
        if (!row.consent_at) {
          return res.status(403).json({ ok: false, error: "no consent — set via /api/wa/conversations/:id/consent first" });
        }
        if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) {
          return res.status(503).json({ ok: false, error: "WhatsApp Cloud API not configured" });
        }
        const phone = row.phone;
        if (!phone) return res.status(400).json({ ok: false, error: "no phone for chat" });
        try {
          const wa = await sendWhatsAppText({
            to: phone,
            text,
            accessToken: config.whatsappAccessToken,
            phoneNumberId: config.whatsappPhoneNumberId,
          });
          const msgId = wa?.messages?.[0]?.id || `cloud_${Date.now()}`;
          await pool.query(
            `insert into wa_messages
               (msg_id, chat_id, ts, direction, type, text, source, status, raw, created_by, meta)
             values ($1, $2, now(), 'out', 'text', $3, 'cloud_api', 'sent', $4::jsonb, $5, $6::jsonb)
             on conflict (msg_id) do nothing`,
            [
              msgId,
              chatId,
              text,
              JSON.stringify({ wa_response: wa }),
              req.waOperatorId,
              JSON.stringify({ outbound_kind: "cloud_api", suggestion_id: suggestionId }),
            ],
          );
          return res.json({ ok: true, kind: "cloud_api", msg_id: msgId });
        } catch (e) {
          return res.status(502).json({ ok: false, error: e.message });
        }
      }

      // paste_back: registramos el mensaje como pending_paste — la extensión confirma con /confirm
      const localId = `paste_${chatId}_${Date.now()}`;
      await pool.query(
        `insert into wa_messages
           (msg_id, chat_id, ts, direction, type, text, source, status, created_by, meta)
         values ($1, $2, now(), 'out', 'text', $3, 'manual', 'pending_paste', $4, $5::jsonb)
         on conflict (msg_id) do nothing`,
        [
          localId,
          chatId,
          text,
          req.waOperatorId,
          JSON.stringify({ outbound_kind: "paste_back", suggestion_id: suggestionId }),
        ],
      );
      return res.json({ ok: true, kind: "paste_back", msg_id: localId, status: "pending_paste" });
    }),
  );

  router.post(
    "/wa/outbound/:msg_id/confirm",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const msgId = String(req.params.msg_id || "").trim();
      if (!msgId) return res.status(400).json({ ok: false, error: "msg_id required" });
      const finalMsgId = req.body?.wa_msg_id ? String(req.body.wa_msg_id).slice(0, 256) : null;

      const r = await pool.query(
        `update wa_messages
            set status = 'sent',
                meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('confirmed_at', now()::text, 'wa_msg_id', $2::text)
          where msg_id = $1
          returning msg_id, chat_id, status`,
        [msgId, finalMsgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, error: "not found" });
      return res.json({ ok: true, item: r.rows[0] });
    }),
  );

  // ── F2 — Suggestion: trigger on-demand (UI puede pedir generar ahora) ──
  router.post(
    "/wa/suggestions/run",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const chatId = String(req.body?.chat_id || "").trim();
      if (!chatId) return res.status(400).json({ ok: false, error: "chat_id required" });

      // Trae histórico (cronológico, último 12)
      const { rows: hist } = await pool.query(
        `select msg_id, direction, text, ts
         from wa_messages
         where chat_id = $1 and text is not null
         order by ts desc
         limit 12`,
        [chatId],
      );
      if (hist.length === 0) {
        return res.status(404).json({ ok: false, error: "no messages for chat" });
      }
      const history = hist.reverse();
      const lastInbound = [...history].reverse().find((m) => m.direction === "in");
      const intentHint = classifyIntent(lastInbound?.text || "");

      const result = await generateSuggestions({ history, intentHint });

      const ins = await pool.query(
        `insert into wa_suggestions
           (chat_id, trigger_msg_id, intent, options, provider, latency_ms, error, meta)
         values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb)
         returning id, chat_id, intent, options, provider, latency_ms, error, generated_at`,
        [
          chatId,
          lastInbound?.msg_id || null,
          result.intent || intentHint,
          JSON.stringify(result.options || []),
          result.provider,
          result.latency_ms,
          result.error || null,
          JSON.stringify({ confidence: result.confidence ?? null, intent_hint: intentHint, on_demand: true }),
        ],
      );
      await pool.query(
        `update wa_conversations set intent_last = $2, updated_at = now() where chat_id = $1`,
        [chatId, result.intent || intentHint],
      );
      return res.json({ ok: true, suggestion: ins.rows[0] });
    }),
  );

  // ── F5 — Heartbeat (extensión registra que está viva) ───────────────────
  router.post(
    "/wa/heartbeat",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const operatorId = String(req.body?.operator_id || req.waOperatorId || "").slice(0, 64).trim();
      if (!operatorId) return res.status(400).json({ ok: false, error: "operator_id required" });
      const version = req.body?.version ? String(req.body.version).slice(0, 32) : null;
      const lastMsgSeen = req.body?.last_msg_seen ? String(req.body.last_msg_seen).slice(0, 256) : null;
      const meta = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : {};

      await pool.query(
        `insert into wa_heartbeats (operator_id, last_seen_at, version, last_msg_seen, meta)
         values ($1, now(), $2, $3, $4::jsonb)
         on conflict (operator_id) do update
           set last_seen_at = excluded.last_seen_at,
               version = coalesce(excluded.version, wa_heartbeats.version),
               last_msg_seen = coalesce(excluded.last_msg_seen, wa_heartbeats.last_msg_seen),
               meta = excluded.meta`,
        [operatorId, version, lastMsgSeen, JSON.stringify(meta)],
      );
      return res.json({ ok: true, operator_id: operatorId, last_seen_at: new Date().toISOString() });
    }),
  );

  router.get(
    "/wa/operators",
    auth,
    requireDb,
    asyncHandler(async (_req, res) => {
      const { rows } = await pool.query(
        `select operator_id, last_seen_at, version, last_msg_seen,
                (extract(epoch from now() - last_seen_at) < 180) as online
         from wa_heartbeats
         order by last_seen_at desc`,
      );
      return res.json({ ok: true, count: rows.length, items: rows });
    }),
  );

  // ── F5 — Metrics: TFR, AI adoption, conversion, volumen por canal ───────
  router.get(
    "/wa/metrics",
    auth,
    requireDb,
    asyncHandler(async (req, res) => {
      const days = Math.min(Math.max(Number(req.query.days || 7), 1), 90);

      // 1) Volumen por canal (in/out · paste_back/cloud_api/wa_web)
      const { rows: byChannel } = await pool.query(
        `select source,
                direction,
                count(*)::int as n
         from wa_messages
         where ts > now() - ($1 || ' days')::interval
         group by source, direction
         order by n desc`,
        [String(days)],
      );

      // 2) TFR mediano (segundos entre msg in y siguiente msg out por chat)
      const { rows: tfrRows } = await pool.query(
        `with pairs as (
           select m1.chat_id,
                  m1.ts as in_ts,
                  (
                    select min(m2.ts)
                    from wa_messages m2
                    where m2.chat_id = m1.chat_id
                      and m2.direction = 'out'
                      and m2.ts > m1.ts
                  ) as out_ts
           from wa_messages m1
           where m1.direction = 'in'
             and m1.ts > now() - ($1 || ' days')::interval
         )
         select percentile_cont(0.5) within group (order by extract(epoch from out_ts - in_ts)) as tfr_p50_sec,
                percentile_cont(0.9) within group (order by extract(epoch from out_ts - in_ts)) as tfr_p90_sec,
                count(*) filter (where out_ts is not null)::int as answered,
                count(*)::int as total_in
         from pairs`,
        [String(days)],
      );

      // 3) AI adoption (sugerencias chosen vs generated)
      const { rows: aiRows } = await pool.query(
        `select count(*) filter (where chosen_idx is not null)::int as chosen,
                count(*)::int as total,
                avg(latency_ms) filter (where latency_ms is not null)::int as avg_latency_ms
         from wa_suggestions
         where generated_at > now() - ($1 || ' days')::interval`,
        [String(days)],
      );

      // 4) Conversion (chats con quote, chats con quote enviada/won)
      const { rows: convRows } = await pool.query(
        `select count(distinct chat_id)::int as chats_with_quote,
                count(*)::int as quotes_total,
                count(*) filter (where status = 'sent')::int as quotes_sent,
                count(*) filter (where status = 'won')::int as quotes_won
         from wa_quotes
         where generated_at > now() - ($1 || ' days')::interval`,
        [String(days)],
      );

      const tfr = tfrRows[0] || {};
      const ai = aiRows[0] || {};
      const conv = convRows[0] || {};

      return res.json({
        ok: true,
        days,
        volume: byChannel,
        tfr_seconds: {
          p50: tfr.tfr_p50_sec != null ? Number(tfr.tfr_p50_sec) : null,
          p90: tfr.tfr_p90_sec != null ? Number(tfr.tfr_p90_sec) : null,
          answered: Number(tfr.answered || 0),
          total_in: Number(tfr.total_in || 0),
        },
        ai_adoption: {
          chosen: Number(ai.chosen || 0),
          total: Number(ai.total || 0),
          rate: ai.total ? Number((ai.chosen / ai.total).toFixed(3)) : 0,
          avg_latency_ms: ai.avg_latency_ms != null ? Number(ai.avg_latency_ms) : null,
        },
        conversion: {
          chats_with_quote: Number(conv.chats_with_quote || 0),
          quotes_total: Number(conv.quotes_total || 0),
          quotes_sent: Number(conv.quotes_sent || 0),
          quotes_won: Number(conv.quotes_won || 0),
        },
      });
    }),
  );

  return router;
}
