// ═══════════════════════════════════════════════════════════════════════════
// server/routes/clientes/customers.js — Panel de Clientes 360 customers read API.
// ───────────────────────────────────────────────────────────────────────────
// Powers /hub/clientes. All routes gated requireUser({module:"clientes"}).
//
//   GET /api/clientes/customers?filter=&search=&orderBy=
//   GET /api/clientes/customers/summary
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

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// MVP §6.3: read access for Sandra; admin can also read.
const CLIENTES_READ = requireUser({ module: "clientes", minLevel: "read" });

// MVP table columns: name, last_contact_at (days), last_quote (total+status), action.
// SQL joins customer → most recent customer_quotes row.
router.get("/api/clientes/customers", readLimiter, CLIENTES_READ, async (req, res) => {
  try {
    const filter = String(req.query.filter || "all"); // all|stale30|with_pending_quote
    const search = String(req.query.search || "").trim();
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const whereParts = [];
    const params = [];
    let p = 0;

    if (filter === "stale30") {
      whereParts.push(
        `(c.last_contact_at IS NULL OR c.last_contact_at < now() - interval '30 days')`,
      );
    } else if (filter === "with_pending_quote") {
      whereParts.push(`EXISTS (SELECT 1 FROM clientes.customer_quotes q
                               WHERE q.customer_id = c.id AND q.status = 'pending')`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      p += 1;
      whereParts.push(
        `(LOWER(c.display_name) LIKE $${p} OR c.primary_phone_e164 LIKE $${p} OR c.primary_email LIKE $${p})`,
      );
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    params.push(limit);
    p += 1;

    const sql = `
      WITH last_quote AS (
        SELECT DISTINCT ON (customer_id)
          customer_id, total_amount, currency, status, created_at
        FROM clientes.customer_quotes
        ORDER BY customer_id, created_at DESC
      )
      SELECT
        c.id, c.display_name, c.primary_phone_e164, c.primary_email,
        c.channels, c.last_contact_at, c.first_seen_at,
        CASE WHEN c.last_contact_at IS NOT NULL
             THEN EXTRACT(DAY FROM (now() - c.last_contact_at))::int
             ELSE NULL END AS days_since_contact,
        q.total_amount AS last_quote_total,
        q.currency     AS last_quote_currency,
        q.status       AS last_quote_status,
        q.created_at   AS last_quote_at
      FROM clientes.customers c
      LEFT JOIN last_quote q ON q.customer_id = c.id
      ${whereSql}
      ORDER BY c.last_contact_at DESC NULLS LAST, c.display_name ASC
      LIMIT $${p}
    `;

    const { rows } = await pool().query(sql, params);
    const total = rows.length;
    res.json({ ok: true, items: rows, total, filter, search });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// Summary KPIs for the MVP header.
router.get("/api/clientes/customers/summary", readLimiter, CLIENTES_READ, async (_req, res) => {
  try {
    const { rows } = await pool().query(`
      SELECT
        COUNT(*)::int AS total_customers,
        COUNT(*) FILTER (
          WHERE last_contact_at IS NULL OR last_contact_at < now() - interval '30 days'
        )::int AS stale_30d,
        COUNT(*) FILTER (
          WHERE last_contact_at >= now() - interval '7 days'
        )::int AS active_7d
      FROM clientes.customers
    `);
    const { rows: pendingRows } = await pool().query(`
      SELECT COUNT(DISTINCT customer_id)::int AS customers_with_pending_quote
      FROM clientes.customer_quotes
      WHERE status = 'pending'
    `);
    const { rows: followupRows } = await pool().query(`
      SELECT COUNT(*)::int AS pending_followups
      FROM clientes.customer_followups
      WHERE status = 'pending'
    `);
    res.json({
      ok: true,
      summary: {
        ...rows[0],
        customers_with_pending_quote: pendingRows[0]?.customers_with_pending_quote || 0,
        pending_followups: followupRows[0]?.pending_followups || 0,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
