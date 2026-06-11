/**
 * Panelin BMC Platform v1 — Router principal
 * Montaje recomendado: app.use("/api/panelin", createPanelinRouter(config, logger))
 *
 * Endpoints mínimos Fase 2:
 *   GET    /products                 → lista con precios + stock (usa vista + reshape)
 *   GET    /products/:sku            → detalle completo (precios, stock por depósito, movimientos recientes, alertas)
 *   PATCH  /products/:sku            → { cost_usd } → actualiza costo + recalcula precios (usa funciones SQL)
 *   GET    /stock                    → snapshot actual de stock
 *   POST   /stock/movements          → registra movimiento (delta) con guardia de stock negativo
 *   GET    /stock/alerts             → alertas de stock bajo
 *   POST   /stock/alerts/:id/ack     → marcar alerta como reconocida
 *   GET    /invoices                 → facturas (mínimo)
 *   POST   /invoices                 → crear/registro manual de factura (para sync futuro)
 *   GET    /status                   → salud del módulo + DB
 *
 * Convenciones:
 * - 503 cuando no hay pool / DB no disponible (igual que otros módulos del repo)
 * - Manejo explícito de stock_negativo → 409
 * - Usa las funciones plpgsql de Fase 1 (panelin_*)
 * - Respuestas siempre con { ok, ... } o { ok: false, error }
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPanelinPool } from "../lib/panelinDb.js";
import { requireAuth } from "../middleware/requireAuth.js";

// IP key for the write limiter. Honors x-forwarded-for because Cloud Run sits
// behind a proxy; falls back to the socket address. Same shape as agentVoice.
function panelinClientKey(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

// Throttle mutating routes (price/stock/invoice writes). 60/min/IP is generous
// for operator/sync use but caps runaway or abusive write loops.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: panelinClientKey,
  message: { ok: false, error: "panelin_rate_limited", message: "Demasiadas operaciones. Esperá un momento." },
});

/**
 * @param {import('../config.js').config} config
 * @param {import('pino').Logger} [logger]
 */
export default function createPanelinRouter(config, logger = console) {
  const router = Router();

  // Force JSON responses
  router.use((_req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  // ---------- AUTH ----------
  // Service-token guard (Bearer API_AUTH_TOKEN / X-Api-Key) over the WHOLE
  // router — reads expose cost_usd/margins, so GETs are guarded too. No
  // browser/SPA caller exists (grep src/ for "api/panelin" is empty), so the
  // static token never reaches a browser. If a frontend admin UI later
  // consumes this router, switch to requireServiceOrUser({ module: "panelin",
  // minLevel: "admin" }) so callers present an ephemeral user JWT instead.
  router.use(requireAuth);

  function getPool() {
    const url = config.databaseUrl || process.env.DATABASE_URL || "";
    return getPanelinPool(url);
  }

  function dbUnavailable(res) {
    return res.status(503).json({
      ok: false,
      error: "panelin_db_unavailable",
      message: "PostgreSQL (Panelin) no disponible. Verifica DATABASE_URL.",
    });
  }

  async function withClient(handler) {
    const pool = getPool();
    if (!pool) return null;

    const client = await pool.connect();
    try {
      return await handler(client);
    } finally {
      client.release();
    }
  }

  // Like withClient but wraps the handler in a single transaction. Use for
  // multi-step mutations that must be atomic (e.g. cost upsert + price recalc):
  // either every statement commits together or none does.
  async function withTx(handler) {
    const pool = getPool();
    if (!pool) return null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const out = await handler(client);
      await client.query("COMMIT");
      return out;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* rollback is best-effort; the original error is rethrown below */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------- STATUS / HEALTH ----------
  router.get("/status", async (_req, res) => {
    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      const result = await withClient(async (c) => {
        const r = await c.query(
          "select now() as db_time, (select count(*) from panelin_schema_migrations) as migrations_applied"
        );
        return r.rows[0];
      });
      res.json({
        ok: true,
        module: "panelin-platform",
        db_connected: true,
        db_time: result?.db_time,
        migrations_applied: Number(result?.migrations_applied || 0),
      });
    } catch (err) {
      logger.error?.({ err }, "[panelin] status check failed");
      return res.status(503).json({ ok: false, error: "panelin_db_error", message: err.message });
    }
  });

  // ---------- PRODUCTS ----------
  router.get("/products", async (req, res) => {
    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    const activeOnly = req.query.active !== "false";

    try {
      const rows = await withClient(async (c) => {
        const where = activeOnly ? "WHERE p.active = true" : "";
        const sql = `
          SELECT 
            p.sku, p.name, p.description, p.unit, p.category, p.cost_usd, p.active,
            pl.code as price_list_code,
            pp.price_usd,
            s.deposito,
            s.qty as stock_qty,
            st.min_qty as threshold,
            (s.qty < coalesce(st.min_qty, 0)) as below_threshold
          FROM products p
          LEFT JOIN product_prices pp ON pp.sku = p.sku
          LEFT JOIN price_lists pl ON pl.id = pp.price_list_id AND pl.active = true
          LEFT JOIN stock s ON s.sku = p.sku
          LEFT JOIN stock_thresholds st ON st.sku = p.sku AND st.deposito = coalesce(s.deposito, 'principal')
          ${where}
          ORDER BY p.sku, pl.code, s.deposito
        `;
        const r = await c.query(sql);
        return r.rows;
      });

      // Reshape a estructura cómoda para el frontend
      const bySku = {};
      for (const r of rows) {
        if (!bySku[r.sku]) {
          bySku[r.sku] = {
            sku: r.sku,
            name: r.name,
            description: r.description,
            unit: r.unit,
            category: r.category,
            cost_usd: Number(r.cost_usd),
            active: r.active,
            prices: {},
            stock: {},
            below_threshold: false,
          };
        }
        const prod = bySku[r.sku];
        if (r.price_list_code && r.price_usd != null) {
          prod.prices[r.price_list_code] = Number(r.price_usd);
        }
        if (r.deposito && r.stock_qty != null) {
          prod.stock[r.deposito] = Number(r.stock_qty);
        }
        if (r.below_threshold) prod.below_threshold = true;
      }

      const products = Object.values(bySku);
      res.json({ ok: true, count: products.length, products });
    } catch (err) {
      logger.error?.({ err }, "[panelin] GET /products failed");
      return res.status(500).json({ ok: false, error: "query_failed", message: err.message });
    }
  });

  router.get("/products/:sku", async (req, res) => {
    const { sku } = req.params;
    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      const data = await withClient(async (c) => {
        // Base product + prices + stock + thresholds
        const prodRes = await c.query(
          `SELECT * FROM panelin_products_full WHERE sku = $1 ORDER BY price_list_code, deposito`,
          [sku]
        );

        // Recent movements (last 20)
        const movRes = await c.query(
          `SELECT id, deposito, delta, qty_after, reason, ref_type, ref_id, created_at, created_by
           FROM stock_movements
           WHERE sku = $1
           ORDER BY created_at DESC
           LIMIT 20`,
          [sku]
        );

        // Open alerts
        const alertRes = await c.query(
          `SELECT id, deposito, current_qty, threshold, severity, created_at
           FROM stock_alerts
           WHERE sku = $1 AND acknowledged = false
           ORDER BY created_at DESC`,
          [sku]
        );

        return {
          product_rows: prodRes.rows,
          movements: movRes.rows,
          alerts: alertRes.rows,
        };
      });

      if (!data.product_rows.length) {
        return res.status(404).json({ ok: false, error: "product_not_found", sku });
      }

      // Reshape similar al list
      const first = data.product_rows[0];
      const detail = {
        sku: first.sku,
        name: first.name,
        description: first.description,
        unit: first.unit,
        category: first.category,
        cost_usd: Number(first.cost_usd),
        active: first.active,
        meta: first.meta,
        prices: {},
        stock: {},
        below_threshold: false,
        movements: data.movements,
        alerts: data.alerts,
      };

      for (const r of data.product_rows) {
        if (r.price_list_code && r.price_usd != null) {
          detail.prices[r.price_list_code] = Number(r.price_usd);
        }
        if (r.deposito && r.stock_qty != null) {
          detail.stock[r.deposito] = Number(r.stock_qty);
        }
        if (r.below_threshold) detail.below_threshold = true;
      }

      res.json({ ok: true, product: detail });
    } catch (err) {
      logger.error?.({ err, sku }, "[panelin] GET /products/:sku failed");
      return res.status(500).json({ ok: false, error: "query_failed", message: err.message });
    }
  });

  router.patch("/products/:sku", writeLimiter, async (req, res) => {
    const { sku } = req.params;
    const { cost_usd } = req.body || {};

    if (cost_usd == null || isNaN(Number(cost_usd))) {
      return res.status(400).json({ ok: false, error: "invalid_cost_usd", message: "cost_usd numérico requerido" });
    }

    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      // One transaction: existence check → cost upsert → price recalc → fresh
      // read → active prices. The cost change and its recalculated prices commit
      // together or not at all (a recalc failure no longer leaves a stale-price
      // split state), and the price read shares the same connection (no stale
      // read across pooled connections).
      const result = await withTx(async (c) => {
        // 0. Existence check FIRST. panelin_upsert_product would otherwise
        //    INSERT a NULL-name row for an unknown SKU before the 404 fired.
        const existing = await c.query(`SELECT name FROM products WHERE sku = $1`, [sku]);
        if (existing.rows.length === 0) {
          return { notFound: true };
        }

        // 1. Upsert the cost (preserving the existing name).
        await c.query(
          `SELECT panelin_upsert_product($1, $2, $3)`,
          [sku, existing.rows[0].name, Number(cost_usd)]
        );

        // 2. Recalculate prices for every active list.
        const recalc = await c.query(`SELECT panelin_recalc_prices_for_sku($1) as affected`, [sku]);

        // 3. Fresh product snapshot.
        const fresh = await c.query(
          `SELECT sku, name, cost_usd, active FROM products WHERE sku = $1`,
          [sku]
        );

        // 4. Updated active prices (same transaction).
        const pricesRes = await c.query(
          `SELECT pl.code, pp.price_usd
             FROM product_prices pp
             JOIN price_lists pl ON pl.id = pp.price_list_id
            WHERE pp.sku = $1 AND pl.active = true`,
          [sku]
        );

        return {
          affected_prices: Number(recalc.rows[0]?.affected || 0),
          product: fresh.rows[0],
          priceRows: pricesRes.rows,
        };
      });

      if (!result || result.notFound || !result.product) {
        return res.status(404).json({ ok: false, error: "product_not_found", sku });
      }

      const prices = {};
      for (const r of result.priceRows) prices[r.code] = Number(r.price_usd);

      res.json({
        ok: true,
        message: "costo actualizado + precios recalculados",
        product: {
          ...result.product,
          cost_usd: Number(result.product.cost_usd),
        },
        prices,
        prices_recalculated: result.affected_prices,
      });
    } catch (err) {
      logger.error?.({ err, sku }, "[panelin] PATCH /products/:sku failed");
      return res.status(500).json({ ok: false, error: "update_failed", message: err.message });
    }
  });

  // ---------- STOCK ----------
  router.get("/stock", async (_req, res) => {
    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      const rows = await withClient(async (c) =>
        c.query(
          `SELECT s.sku, p.name, s.deposito, s.qty, s.last_movement_at, st.min_qty as threshold,
                  (s.qty < coalesce(st.min_qty, 0)) as below_threshold
           FROM stock s
           JOIN products p ON p.sku = s.sku
           LEFT JOIN stock_thresholds st ON st.sku = s.sku AND st.deposito = s.deposito
           ORDER BY s.sku, s.deposito`
        )
      );

      res.json({
        ok: true,
        count: rows.rows.length,
        stock: rows.rows.map((r) => ({
          sku: r.sku,
          name: r.name,
          deposito: r.deposito,
          qty: Number(r.qty),
          last_movement_at: r.last_movement_at,
          threshold: r.threshold != null ? Number(r.threshold) : null,
          below_threshold: r.below_threshold,
        })),
      });
    } catch (err) {
      logger.error?.({ err }, "[panelin] GET /stock failed");
      return res.status(500).json({ ok: false, error: "query_failed", message: err.message });
    }
  });

  router.post("/stock/movements", writeLimiter, async (req, res) => {
    const { sku, deposito = "principal", delta, reason = "manual", ref_type, ref_id, created_by } = req.body || {};

    if (!sku || delta == null || isNaN(Number(delta))) {
      return res.status(400).json({ ok: false, error: "invalid_payload", message: "sku y delta numérico son requeridos" });
    }

    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      const movement = await withClient(async (c) => {
        const r = await c.query(
          `SELECT * FROM panelin_record_stock_movement($1, $2, $3, $4, $5, $6, $7)`,
          [sku, deposito, Number(delta), reason, ref_type || null, ref_id || null, created_by || null]
        );
        return r.rows[0];
      });

      res.status(201).json({
        ok: true,
        movement: {
          id: movement.id,
          sku: movement.sku,
          deposito: movement.deposito,
          delta: Number(movement.delta),
          qty_after: Number(movement.qty_after),
          reason: movement.reason,
          created_at: movement.created_at,
        },
      });
    } catch (err) {
      if (err.message && err.message.includes("stock_negativo")) {
        return res.status(409).json({
          ok: false,
          error: "stock_negativo",
          message: err.message,
        });
      }
      logger.error?.({ err }, "[panelin] POST /stock/movements failed");
      return res.status(500).json({ ok: false, error: "movement_failed", message: err.message });
    }
  });

  router.get("/stock/alerts", async (req, res) => {
    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    const onlyOpen = req.query.open !== "false";

    try {
      const rows = await withClient(async (c) => {
        const where = onlyOpen ? "WHERE acknowledged = false" : "";
        const r = await c.query(
          `SELECT id, sku, deposito, current_qty, threshold, severity, acknowledged, created_at
           FROM stock_alerts
           ${where}
           ORDER BY created_at DESC
           LIMIT 100`
        );
        return r.rows;
      });

      res.json({ ok: true, count: rows.length, alerts: rows });
    } catch (err) {
      logger.error?.({ err }, "[panelin] GET /stock/alerts failed");
      return res.status(500).json({ ok: false, error: "query_failed", message: err.message });
    }
  });

  router.post("/stock/alerts/:id/ack", writeLimiter, async (req, res) => {
    const { id } = req.params;
    const { acknowledged_by = "operator" } = req.body || {};

    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      const updated = await withClient(async (c) =>
        c.query(
          `UPDATE stock_alerts
           SET acknowledged = true, acknowledged_at = now(), acknowledged_by = $2
           WHERE id = $1
           RETURNING *`,
          [id, acknowledged_by]
        )
      );

      if (!updated.rows.length) {
        return res.status(404).json({ ok: false, error: "alert_not_found" });
      }

      res.json({ ok: true, alert: updated.rows[0] });
    } catch (err) {
      logger.error?.({ err }, "[panelin] POST /stock/alerts/:id/ack failed");
      return res.status(500).json({ ok: false, error: "ack_failed", message: err.message });
    }
  });

  // ---------- INVOICES (mínimo para Fase 2) ----------
  router.get("/invoices", async (req, res) => {
    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    const limit = Math.min(Number(req.query.limit) || 50, 200);

    try {
      const rows = await withClient(async (c) =>
        c.query(
          `SELECT id, external_id, number, date, client_name, total_usd, status, source, created_at
           FROM invoices
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        )
      );
      res.json({ ok: true, count: rows.rows.length, invoices: rows.rows });
    } catch (err) {
      logger.error?.({ err }, "[panelin] GET /invoices failed");
      return res.status(500).json({ ok: false, error: "query_failed", message: err.message });
    }
  });

  router.post("/invoices", writeLimiter, async (req, res) => {
    const { external_id, number, date, client_name, total_usd, status = "issued", source = "manual", raw } = req.body || {};

    if (!client_name && !external_id) {
      return res.status(400).json({ ok: false, error: "invalid_payload", message: "client_name o external_id requerido" });
    }

    const pool = getPool();
    if (!pool) return dbUnavailable(res);

    try {
      const inserted = await withClient(async (c) =>
        c.query(
          `INSERT INTO invoices (external_id, number, date, client_name, total_usd, status, source, raw)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [external_id || null, number || null, date || null, client_name, total_usd ? Number(total_usd) : null, status, source, raw || null]
        )
      );

      res.status(201).json({ ok: true, invoice: inserted.rows[0] });
    } catch (err) {
      if (err.code === "23505") {
        // unique violation on external_id
        return res.status(409).json({ ok: false, error: "duplicate_external_id" });
      }
      logger.error?.({ err }, "[panelin] POST /invoices failed");
      return res.status(500).json({ ok: false, error: "insert_failed", message: err.message });
    }
  });

  return router;
}
