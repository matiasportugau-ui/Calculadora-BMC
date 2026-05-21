// ═══════════════════════════════════════════════════════════════════════════
// server/routes/identityMe.js — endpoints scoped to the authenticated user.
// ───────────────────────────────────────────────────────────────────────────
//   GET  /api/me/notifications              list user inbox
//   PATCH /api/me/notifications/:id          mark read
//   GET  /api/me/access-requests             list own access requests
//   POST /api/access-requests                request access to a module
//   POST /api/me/special-quote-requests      file a >USD 8500 follow-up
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
// cursor[bot] round-5 LOW: scrub raw DB messages from wire responses.
// Shared with quoteExport.js — see server/lib/safeErr.js.
import { safeErr as _safeErr } from "../lib/safeErr.js";
import {
  listMyQuotes,
  getMyQuote,
  softDeleteQuote,
  upsertQuote,
  claimAnonymousQuotes,
} from "../lib/quoteStore.js";
import {
  syncQuote as sheetSyncQuote,
  reconcile as sheetReconcile,
  isSheetSyncEnabled,
} from "../lib/clientQuotesSheetSync.js";

const router = express.Router();

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

/** Test-only — inject the same in-memory shim used by quoteStore + identityAuth. */
export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

async function notifySuperadmins({ kind, title, body, payload }) {
  const p = pool();
  const { rows } = await p.query(
    `select user_id from identity.role_grants where role = 'superadmin'`,
  );
  if (!rows.length) return;
  const values = rows.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}::jsonb)`).join(",");
  const params = rows.flatMap((r) => [r.user_id, kind, title, body || null, JSON.stringify(payload || {})]);
  await p.query(
    `insert into identity.notifications (user_id, kind, title, body, payload) values ${values}`,
    params,
  );
}

// ─── Notifications ─────────────────────────────────────────────────────

router.get("/api/me/notifications", requireUser(), async (req, res) => {
  try {
    const onlyUnread = String(req.query.unread || "").toLowerCase() === "true";
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const sql = onlyUnread
      ? `select notification_id, kind, title, body, payload, read_at, created_at
           from identity.notifications
          where user_id = $1 and read_at is null
          order by created_at desc limit $2`
      : `select notification_id, kind, title, body, payload, read_at, created_at
           from identity.notifications
          where user_id = $1
          order by created_at desc limit $2`;
    const { rows } = await pool().query(sql, [req.user.id, limit]);
    res.json({ ok: true, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.patch("/api/me/notifications/:id", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool().query(
      `update identity.notifications
          set read_at = coalesce(read_at, now())
        where notification_id = $1 and user_id = $2
        returning notification_id, read_at`,
      [id, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, notification: rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Access requests ───────────────────────────────────────────────────

const ALLOWED_MODULES = new Set([
  "calc", "wa", "ml", "admin", "plan-import", "agent-admin", "canales", "crm-personal",
]);
// cursor[bot] F-2: canonical level set — anything else writes garbage into
// identity.module_grants and breaks _levelAllows reasoning silently.
const VALID_LEVELS = new Set(["none", "read", "write", "admin"]);

// cursor[bot] round-8 W-1: quote status enum. Comprador-supplied status
// must NOT be allowed to set 'completed' (would auto-trigger Sheets sync)
// or 'deleted' (would bypass softDeleteQuote audit event). 'exported' is
// admin-only too — keep it out of the user-input allowlist. Anything not
// in the user-input set silently coerces to 'draft'.
const VALID_USER_QUOTE_STATUSES = new Set(["draft"]);

// cursor[bot] round-8 W-3: admin access-request status query enum.
const VALID_AR_STATUSES = new Set(["pending", "granted", "denied"]);

// cursor[bot] round-8 W-2: cap free-form notes fields. The rate limit is
// 10 req / 15 min per user; without a per-request cap, an attacker can
// still ship 10 × N MB notes that fan out as superadmin notifications.
const MAX_NOTES_LEN = 2000;
function _capNotes(value) {
  if (typeof value !== "string") return null;
  return value.slice(0, MAX_NOTES_LEN);
}

// Self-audit fix: per-user rate limits on the abuse-vector POST endpoints.
// Key by req.user.id (not IP) so multiple users behind the same NAT/proxy
// don't collide. requireUser runs before these limiters and populates
// req.user; if for any reason it isn't there yet, we degrade to IP keying.
function _userOrIpKey(req /*, res */) {
  return req.user?.id || req.ip;
}

// Spam-vector limiters — different rates per route.
// /access-requests + /special-quote-requests are admin-queue inputs that
// should not be flooded; /me/quotes is a user-driven workflow upsert and
// can tolerate higher volume.
const accessRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: _userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

const specialQuoteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: _userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

const meQuotesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: _userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: _userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "rate_limited", retryAfterSec: 60 },
});

router.post("/api/access-requests", requireUser(), accessRequestLimiter, async (req, res) => {
  try {
    const { module: m, notes } = req.body || {};
    if (!m || !ALLOWED_MODULES.has(m)) {
      return res.status(400).json({ ok: false, error: "invalid_module" });
    }
    const ins = await pool().query(
      `insert into identity.access_requests (user_id, module, notes)
       values ($1, $2, $3)
       returning request_id, status, created_at`,
      [req.user.id, m, _capNotes(notes)],
    );
    const rec = ins.rows[0];
    // Self-audit fix: drop requester_email from structured payload — it's
    // already in the human-readable body. Keep only IDs in the JSONB so
    // notification queries don't surface PII unintentionally.
    await notifySuperadmins({
      kind: "access_request",
      title: `Solicitud de acceso a "${m}"`,
      body: `${req.user.email} solicitó acceso al módulo ${m}.`,
      payload: { request_id: rec.request_id, module: m, requester_id: req.user.id },
    });
    res.json({ ok: true, request: rec });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/access-requests", requireUser(), async (req, res) => {
  try {
    const { rows } = await pool().query(
      `select request_id, module, status, notes, resolved_at, created_at
         from identity.access_requests
        where user_id = $1
        order by created_at desc limit 100`,
      [req.user.id],
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// Admin: list all pending and resolve.
router.get("/api/admin/access-requests", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const status = String(req.query.status || "pending");
    // W-3: enum guard — bad input would silently return 0 rows otherwise.
    if (!VALID_AR_STATUSES.has(status)) {
      return res.status(400).json({ ok: false, error: "invalid_status", allowed: [...VALID_AR_STATUSES] });
    }
    const { rows } = await pool().query(
      `select ar.request_id, ar.user_id, u.email, u.name, ar.module, ar.status, ar.notes,
              ar.resolved_by, ar.resolved_at, ar.created_at
         from identity.access_requests ar
         join identity.users u on u.user_id = ar.user_id
        where ar.status = $1
        order by ar.created_at desc limit 200`,
      [status],
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.patch("/api/admin/access-requests/:id", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, level } = req.body || {};
    if (!["granted", "denied"].includes(decision)) {
      return res.status(400).json({ ok: false, error: "invalid_decision" });
    }
    // F-2: only enforce the level enum when actually granting. If the admin
    // omits `level`, default to 'read' below; if they supplied a non-enum
    // value, refuse outright instead of silently demoting to 'read'.
    if (decision === "granted" && level !== undefined && !VALID_LEVELS.has(level)) {
      return res.status(400).json({ ok: false, error: "invalid_level", allowed: [...VALID_LEVELS] });
    }
    const lookup = await pool().query(
      `select user_id, module from identity.access_requests where request_id = $1`,
      [id],
    );
    if (!lookup.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
    const ar = lookup.rows[0];

    await pool().query(
      `update identity.access_requests
          set status = $2, resolved_by = $3, resolved_at = now()
        where request_id = $1`,
      [id, decision, req.user.id],
    );
    if (decision === "granted") {
      await pool().query(
        `insert into identity.module_grants (user_id, module, level, granted_by)
         values ($1, $2, $3, $4)
         on conflict (user_id, module) do update
            set level = excluded.level, granted_by = excluded.granted_by, granted_at = now()`,
        [ar.user_id, ar.module, level || "read", req.user.id],
      );
    }
    await pool().query(
      `insert into identity.notifications (user_id, kind, title, body, payload)
       values ($1, 'access_decision', $2, null, $3::jsonb)`,
      [
        ar.user_id,
        decision === "granted" ? `Tu acceso a "${ar.module}" fue aprobado` : `Tu solicitud de acceso a "${ar.module}" fue denegada`,
        JSON.stringify({ module: ar.module, level: level || "read", decision }),
      ],
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Special-quote (>USD 8500) requests ────────────────────────────────

router.post("/api/me/special-quote-requests", requireUser(), specialQuoteLimiter, async (req, res) => {
  try {
    const { quoteId, notes } = req.body || {};
    if (!quoteId || typeof quoteId !== "string") {
      return res.status(400).json({ ok: false, error: "missing_quoteId" });
    }
    const q = await pool().query(
      `select quote_id, total_usd from identity.quotes
        where quote_id = $1 and user_id = $2 and status <> 'deleted'`,
      [quoteId, req.user.id],
    );
    if (!q.rows.length) return res.status(404).json({ ok: false, error: "quote_not_found" });
    const total = Number(q.rows[0].total_usd) || 0;
    if (total <= 8500) {
      return res.status(400).json({
        ok: false,
        error: "quote_not_eligible",
        detail: "Special-quote requests require total_usd > 8500",
      });
    }
    const ins = await pool().query(
      `insert into identity.special_quote_requests (quote_id, user_id, notes)
       values ($1, $2, $3) returning request_id, status, created_at`,
      [quoteId, req.user.id, _capNotes(notes)],
    );
    const rec = ins.rows[0];
    await notifySuperadmins({
      kind: "special_quote",
      title: `Presupuesto especial > USD 8500 (${total.toFixed(2)})`,
      body: `${req.user.email} solicitó presupuesto especial.`,
      payload: { request_id: rec.request_id, quote_id: quoteId, total_usd: total },
    });
    res.json({ ok: true, request: rec });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/special-quote-requests", requireUser(), async (req, res) => {
  try {
    const { rows } = await pool().query(
      `select sqr.request_id, sqr.quote_id, sqr.notes, sqr.status, sqr.created_at,
              q.total_usd
         from identity.special_quote_requests sqr
         left join identity.quotes q on q.quote_id = sqr.quote_id
        where sqr.user_id = $1
        order by sqr.created_at desc limit 50`,
      [req.user.id],
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Per-user quotes ───────────────────────────────────────────────────

router.get("/api/me/quotes", requireUser(), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const items = await listMyQuotes({ userId: req.user.id, limit });
    res.json({ ok: true, items });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/quotes/:id", requireUser(), async (req, res) => {
  try {
    const q = await getMyQuote({ userId: req.user.id, quoteId: req.params.id });
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, quote: q });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.post("/api/me/quotes", requireUser(), meQuotesLimiter, async (req, res) => {
  try {
    const { clientQuoteId, payload, status, wizardStep, pdfId, pdfUrl, gcsUri, driveFileId } = req.body || {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "missing_payload" });
    }
    // W-1: silently coerce any non-allowlisted status to 'draft'. Server-side
    // workflow (calc completion path, admin queue, soft delete) is what flips
    // status to 'completed', 'exported', or 'deleted' — never a user POST.
    const safeStatus = VALID_USER_QUOTE_STATUSES.has(status) ? status : "draft";
    const q = await upsertQuote({
      userId: req.user.id,
      clientQuoteId,
      payload,
      pdfId, pdfUrl, gcsUri, driveFileId,
      status: safeStatus,
      wizardStep,
    });
    res.json({ ok: true, quote: q });
  } catch (e) {
    // cursor[bot] LOW: match the F-1/W-3 pattern from authGoogle.js — log
    // e.detail server-side, return only the coarse error code on the wire.
    if (e.detail) req.log?.warn?.({ detail: e.detail }, "[me/quotes] upsert detail");
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.delete("/api/me/quotes/:id", requireUser(), async (req, res) => {
  try {
    const q = await softDeleteQuote({ userId: req.user.id, quoteId: req.params.id });
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// cursor[bot] W-3: cap input + format check so a hostile body (`{clientQuoteIds:
// [<100k strings>]}`) can't trigger an unbounded ANY($::text[]) scan.
const CLAIM_ID_MAX = 100;
const CLAIM_ID_PATTERN = /^cq_[A-Za-z0-9_-]{8,}$/;

router.post("/api/me/quotes/claim", requireUser(), claimLimiter, async (req, res) => {
  try {
    const raw = Array.isArray(req.body?.clientQuoteIds) ? req.body.clientQuoteIds : [];
    const ids = raw
      .filter((id) => typeof id === "string" && CLAIM_ID_PATTERN.test(id))
      .slice(0, CLAIM_ID_MAX);
    const r = await claimAnonymousQuotes({ userId: req.user.id, clientQuoteIds: ids });
    res.json({ ok: true, claimed: r.claimed, accepted: ids.length, submitted: raw.length });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Admin: Sheets sync «Base de datos cotis de clientes» ──────────────

router.get("/api/admin/sheets/clientes/status", requireUser({ role: "admin" }), async (_req, res) => {
  res.json({
    ok: true,
    enabled: isSheetSyncEnabled(),
    spreadsheet_id: config.bmcSheetId || null,
    tab: config.sheetsClientQuotesTab,
  });
});

router.post("/api/admin/sheets/clientes/reconcile", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const result = await sheetReconcile({ actorUserId: req.user.id, limit: Number(req.body?.limit) || 200 });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.post("/api/admin/sheets/clientes/sync/:quote_id", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const result = await sheetSyncQuote({
      quoteId: req.params.quote_id,
      batchId: `manual-${Date.now().toString(36)}`,
      actorUserId: req.user.id,
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── User directory (lightweight, for any authenticated user) ─────────

const userSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Returns minimal user info — used by the Mensajes flow to look up other
// users by email/name. Does NOT expose roles, status, or audit details
// (those belong to the admin surface). Requires q with ≥2 chars.
router.get("/api/me/users/search", requireUser(), userSearchLimiter, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (q.length < 2) return res.json({ ok: true, items: [] });
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const { rows } = await pool().query(
      `SELECT user_id, email, name, picture_url
         FROM identity.users
        WHERE status = 'active'
          AND user_id <> $1
          AND (email ILIKE $2 OR name ILIKE $2)
        ORDER BY (CASE WHEN email ILIKE $3 THEN 0 ELSE 1 END), email
        LIMIT $4`,
      [req.user.id, `%${q}%`, `${q}%`, limit],
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Internal Messages (threads + messages) ────────────────────────────

const messagesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// List threads where the user is a member, with unread count + last message preview
router.get("/api/me/threads", requireUser(), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool().query(
      `SELECT t.thread_id, t.subject, t.created_at, t.last_message_at,
              tm.last_read_at,
              (SELECT count(*) FROM identity.messages m
                WHERE m.thread_id = t.thread_id
                  AND m.created_at > COALESCE(tm.last_read_at, '1970-01-01'::timestamptz)
                  AND m.from_user_id <> $1) AS unread_count,
              (SELECT count(*) FROM identity.message_thread_members WHERE thread_id = t.thread_id) AS member_count,
              (SELECT json_build_object(
                  'body', m2.body,
                  'from_user_id', m2.from_user_id,
                  'created_at', m2.created_at
                ) FROM identity.messages m2
                WHERE m2.thread_id = t.thread_id
                ORDER BY m2.created_at DESC LIMIT 1) AS last_message
         FROM identity.message_threads t
         JOIN identity.message_thread_members tm ON tm.thread_id = t.thread_id AND tm.user_id = $1
         ORDER BY t.last_message_at DESC
         LIMIT $2`,
      [req.user.id, limit],
    );
    res.json({ ok: true, items: rows });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// Messages in a thread (only if user is a member)
router.get("/api/me/threads/:id/messages", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;
    const member = await pool().query(
      `SELECT 1 FROM identity.message_thread_members WHERE thread_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    if (!member.rows.length) return res.status(403).json({ ok: false, error: "not_a_member" });
    const [thread, messages, members] = await Promise.all([
      pool().query(
        `SELECT thread_id, subject, created_by, created_at, last_message_at
           FROM identity.message_threads WHERE thread_id = $1`,
        [id],
      ),
      pool().query(
        `SELECT m.message_id, m.from_user_id, m.body, m.created_at,
                u.email AS from_email, u.name AS from_name, u.picture_url AS from_picture
           FROM identity.messages m
           LEFT JOIN identity.users u ON u.user_id = m.from_user_id
           WHERE m.thread_id = $1
           ORDER BY m.created_at ASC`,
        [id],
      ),
      pool().query(
        `SELECT tm.user_id, tm.last_read_at, u.email, u.name, u.picture_url
           FROM identity.message_thread_members tm
           JOIN identity.users u ON u.user_id = tm.user_id
           WHERE tm.thread_id = $1`,
        [id],
      ),
    ]);
    res.json({
      ok: true,
      thread: thread.rows[0] || null,
      messages: messages.rows,
      members: members.rows,
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// Create a thread with the given members + first message
router.post("/api/me/threads", requireUser(), messagesLimiter, async (req, res) => {
  try {
    const subject = String(req.body?.subject || "").trim().slice(0, 200);
    const body = String(req.body?.body || "").trim().slice(0, 4000);
    const memberIds = Array.isArray(req.body?.member_user_ids) ? req.body.member_user_ids : [];
    if (!subject) return res.status(400).json({ ok: false, error: "missing_subject" });
    if (!body) return res.status(400).json({ ok: false, error: "missing_body" });
    if (!memberIds.length) return res.status(400).json({ ok: false, error: "missing_members" });

    const allIds = Array.from(new Set([req.user.id, ...memberIds]));
    // Validate all member ids exist as real users.
    const validated = await pool().query(
      `SELECT user_id FROM identity.users WHERE user_id = ANY($1::uuid[])`,
      [allIds],
    );
    if (validated.rows.length !== allIds.length) {
      return res.status(400).json({ ok: false, error: "invalid_member_id" });
    }

    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const t = await client.query(
        `INSERT INTO identity.message_threads (subject, created_by)
         VALUES ($1, $2) RETURNING thread_id, subject, created_at, last_message_at`,
        [subject, req.user.id],
      );
      const thread = t.rows[0];
      const memberValues = allIds.map((_, i) => `($1, $${i + 2})`).join(",");
      await client.query(
        `INSERT INTO identity.message_thread_members (thread_id, user_id) VALUES ${memberValues}`,
        [thread.thread_id, ...allIds],
      );
      const m = await client.query(
        `INSERT INTO identity.messages (thread_id, from_user_id, body)
         VALUES ($1, $2, $3) RETURNING message_id, body, created_at`,
        [thread.thread_id, req.user.id, body],
      );
      // Sender already saw the message they just sent
      await client.query(
        `UPDATE identity.message_thread_members SET last_read_at = now()
         WHERE thread_id = $1 AND user_id = $2`,
        [thread.thread_id, req.user.id],
      );
      await client.query(
        `UPDATE identity.message_threads SET last_message_at = now() WHERE thread_id = $1`,
        [thread.thread_id],
      );
      await client.query("COMMIT");

      // Notify other members (best-effort, outside the transaction)
      const others = allIds.filter((id) => id !== req.user.id);
      if (others.length) {
        const otherValues = others.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}::jsonb)`).join(",");
        const params = others.flatMap((uid) => [
          uid,
          "message",
          `Nuevo hilo: ${subject}`,
          body.slice(0, 120),
          JSON.stringify({ thread_id: thread.thread_id }),
        ]);
        await pool().query(
          `INSERT INTO identity.notifications (user_id, kind, title, body, payload) VALUES ${otherValues}`,
          params,
        );
      }

      res.status(201).json({ ok: true, thread, first_message: m.rows[0] });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// Reply to an existing thread
router.post("/api/me/threads/:id/messages", requireUser(), messagesLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const body = String(req.body?.body || "").trim().slice(0, 4000);
    if (!body) return res.status(400).json({ ok: false, error: "missing_body" });
    const member = await pool().query(
      `SELECT 1 FROM identity.message_thread_members WHERE thread_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    if (!member.rows.length) return res.status(403).json({ ok: false, error: "not_a_member" });
    const m = await pool().query(
      `INSERT INTO identity.messages (thread_id, from_user_id, body)
       VALUES ($1, $2, $3) RETURNING message_id, body, created_at`,
      [id, req.user.id, body],
    );
    await pool().query(
      `UPDATE identity.message_threads SET last_message_at = now() WHERE thread_id = $1`,
      [id],
    );
    await pool().query(
      `UPDATE identity.message_thread_members SET last_read_at = now()
       WHERE thread_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    res.status(201).json({ ok: true, message: m.rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// Mark thread as read (bumps last_read_at for this user)
router.patch("/api/me/threads/:id/read", requireUser(), async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool().query(
      `UPDATE identity.message_thread_members SET last_read_at = now()
       WHERE thread_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    if (!rowCount) return res.status(403).json({ ok: false, error: "not_a_member" });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
