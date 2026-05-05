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
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import {
  listMyQuotes,
  getMyQuote,
  softDeleteQuote,
  upsertQuote,
  claimAnonymousQuotes,
} from "../lib/quoteStore.js";

const router = express.Router();

function pool() {
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

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
    res.status(e.status || 500).json({ ok: false, error: e.message });
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
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// ─── Access requests ───────────────────────────────────────────────────

const ALLOWED_MODULES = new Set([
  "calc", "wa", "ml", "admin", "plan-import", "agent-admin", "canales", "crm-personal",
]);

router.post("/api/access-requests", requireUser(), async (req, res) => {
  try {
    const { module: m, notes } = req.body || {};
    if (!m || !ALLOWED_MODULES.has(m)) {
      return res.status(400).json({ ok: false, error: "invalid_module" });
    }
    const ins = await pool().query(
      `insert into identity.access_requests (user_id, module, notes)
       values ($1, $2, $3)
       returning request_id, status, created_at`,
      [req.user.id, m, notes || null],
    );
    const rec = ins.rows[0];
    await notifySuperadmins({
      kind: "access_request",
      title: `Solicitud de acceso a "${m}"`,
      body: `${req.user.email} solicitó acceso al módulo ${m}.`,
      payload: { request_id: rec.request_id, module: m, requester_id: req.user.id, requester_email: req.user.email },
    });
    res.json({ ok: true, request: rec });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
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
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// Admin: list all pending and resolve.
router.get("/api/admin/access-requests", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const status = String(req.query.status || "pending");
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
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

router.patch("/api/admin/access-requests/:id", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, level } = req.body || {};
    if (!["granted", "denied"].includes(decision)) {
      return res.status(400).json({ ok: false, error: "invalid_decision" });
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
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// ─── Special-quote (>USD 8500) requests ────────────────────────────────

router.post("/api/me/special-quote-requests", requireUser(), async (req, res) => {
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
      [quoteId, req.user.id, notes || null],
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
    res.status(e.status || 500).json({ ok: false, error: e.message });
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
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

// ─── Per-user quotes ───────────────────────────────────────────────────

router.get("/api/me/quotes", requireUser(), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const items = await listMyQuotes({ userId: req.user.id, limit });
    res.json({ ok: true, items });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

router.get("/api/me/quotes/:id", requireUser(), async (req, res) => {
  try {
    const q = await getMyQuote({ userId: req.user.id, quoteId: req.params.id });
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, quote: q });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

router.post("/api/me/quotes", requireUser(), async (req, res) => {
  try {
    const { clientQuoteId, payload, status, wizardStep, pdfId, pdfUrl, gcsUri, driveFileId } = req.body || {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "missing_payload" });
    }
    const q = await upsertQuote({
      userId: req.user.id,
      clientQuoteId,
      payload,
      pdfId, pdfUrl, gcsUri, driveFileId,
      status: status || "draft",
      wizardStep,
    });
    res.json({ ok: true, quote: q });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

router.delete("/api/me/quotes/:id", requireUser(), async (req, res) => {
  try {
    const q = await softDeleteQuote({ userId: req.user.id, quoteId: req.params.id });
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

router.post("/api/me/quotes/claim", requireUser(), async (req, res) => {
  try {
    const ids = req.body?.clientQuoteIds || [];
    const r = await claimAnonymousQuotes({ userId: req.user.id, clientQuoteIds: ids });
    res.json({ ok: true, claimed: r.claimed });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

export default router;
