// ═══════════════════════════════════════════════════════════════════════════
// server/routes/clientes/followups.js — Panel de Clientes 360 followups API.
// ───────────────────────────────────────────────────────────────────────────
// POST creates a "contacted" followup record (status='done', completed now)
// — that's the MVP's primary user action: Sandra marks a customer as
// contacted, we audit-log it for the kill-switch metric.
//
//   POST /api/clientes/followups   { customer_id, reason? }
//   GET  /api/clientes/followups?customer_id=...&status=...
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../../lib/waDb.js";
import { config } from "../../config.js";
import { requireUser } from "../../lib/identityAuth.js";
import { safeErr as _safeErr } from "../../lib/safeErr.js";

const router = express.Router();

function pool() {
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const CLIENTES_READ = requireUser({ module: "clientes", minLevel: "read" });
const CLIENTES_WRITE = requireUser({ module: "clientes", minLevel: "write" });

router.post("/api/clientes/followups", writeLimiter, CLIENTES_WRITE, async (req, res) => {
  try {
    const { customer_id, reason } = req.body || {};
    if (!customer_id || typeof customer_id !== "string") {
      return res.status(400).json({ ok: false, error: "customer_id required" });
    }
    const safeReason = String(reason || "Marcado como contactado").slice(0, 500);

    const { rows: customerRows } = await pool().query(
      `SELECT id FROM clientes.customers WHERE id = $1`,
      [customer_id],
    );
    if (customerRows.length === 0) {
      return res.status(404).json({ ok: false, error: "customer_not_found" });
    }

    const { rows } = await pool().query(
      `INSERT INTO clientes.customer_followups
         (customer_id, due_date, reason, status, assigned_to_user_id, completed_at)
       VALUES ($1, current_date, $2, 'done', $3, now())
       RETURNING id, customer_id, status, reason, completed_at`,
      [customer_id, safeReason, req.user.id],
    );

    // Bump last_contact_at on the customer (defensive — also bumped by event sync).
    await pool().query(
      `UPDATE clientes.customers SET last_contact_at = now() WHERE id = $1`,
      [customer_id],
    );

    res.status(201).json({ ok: true, followup: rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/clientes/followups", readLimiter, CLIENTES_READ, async (req, res) => {
  try {
    const customer_id = req.query.customer_id ? String(req.query.customer_id) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const whereParts = [];
    const params = [];
    let p = 0;
    if (customer_id) {
      params.push(customer_id); p += 1;
      whereParts.push(`f.customer_id = $${p}`);
    }
    if (status) {
      params.push(status); p += 1;
      whereParts.push(`f.status = $${p}`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit); p += 1;

    const sql = `
      SELECT f.id, f.customer_id, c.display_name AS customer_name,
             f.due_date, f.reason, f.status, f.completed_at, f.created_at,
             f.assigned_to_user_id, u.email AS assigned_to_email
        FROM clientes.customer_followups f
        LEFT JOIN clientes.customers c ON c.id = f.customer_id
        LEFT JOIN identity.users u ON u.user_id = f.assigned_to_user_id
        ${whereSql}
        ORDER BY f.created_at DESC
        LIMIT $${p}
    `;
    const { rows } = await pool().query(sql, params);
    res.json({ ok: true, items: rows, total: rows.length });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
