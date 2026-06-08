// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Mount in server/index.js:
//   import marketingRouter from './routes/marketing.js';
//   app.use('/api/marketing', marketingRouter);

import { Router } from 'express';
import pino from 'pino';
import { requireAuth } from '../middleware/requireAuth.js';
import { pool, isNotProvisioned } from '../lib/marketIntel/db.js';
import { listPendingTasks, updateTaskStatus } from '../lib/marketIntel/mysteryShoppingQueue.js';
import { runEtl } from '../lib/marketIntel/etl/runner.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const router = Router();

// `pool` + `isNotProvisioned` come from lib/marketIntel/db.js, shared with
// mysteryShoppingQueue.js so the not-provisioned contract lives in one place.
// These builders shape the empty 200 payloads the routes serve in that state.
const emptySummary = () => ({
  last_etl_run: null,
  alert_counts: { info: 0, warning: 0, critical: 0 },
  top_competitors_by_delta: [],
  pending_mystery_shopping_count: 0,
  provisioned: false,
});

const emptyPage = (page, perPage) => ({
  data: [],
  total: 0,
  page,
  per_page: perPage,
  total_pages: 0,
  provisioned: false,
});

// ─── GET /api/marketing/dashboard/summary ─────────────────────────
router.get('/dashboard/summary', requireAuth, async (req, res) => {
  try {
    const [lastRunResult, alertCountResult, deltaResult, msPendingResult] = await Promise.all([
      pool().query(`SELECT * FROM bmc_market_intel.v_last_etl_run`),
      pool().query(`SELECT * FROM bmc_market_intel.v_alert_counts`),
      pool().query(`SELECT * FROM bmc_market_intel.v_top_competitors_by_delta`),
      pool().query(
        `SELECT COUNT(*) AS count FROM bmc_market_intel.mystery_shopping_queue WHERE status = 'pending'`
      ),
    ]);

    res.json({
      last_etl_run: lastRunResult.rows[0] ?? null,
      alert_counts: {
        info:     parseInt(alertCountResult.rows[0]?.info_count ?? '0', 10),
        warning:  parseInt(alertCountResult.rows[0]?.warning_count ?? '0', 10),
        critical: parseInt(alertCountResult.rows[0]?.critical_count ?? '0', 10),
      },
      top_competitors_by_delta: deltaResult.rows,
      pending_mystery_shopping_count: parseInt(msPendingResult.rows[0]?.count ?? '0', 10),
    });
  } catch (err) {
    if (isNotProvisioned(err)) {
      log.warn({ err, route: 'GET /dashboard/summary' }, 'market-intel not provisioned — serving empty payload');
      return res.json(emptySummary());
    }
    log.error({ err, route: 'GET /dashboard/summary' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── GET /api/marketing/dashboard/competitors ─────────────────────
router.get('/dashboard/competitors', requireAuth, async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '25', 10)));
  try {
    const offset  = (page - 1) * perPage;

    const [data, count] = await Promise.all([
      pool().query(
        `SELECT * FROM bmc_market_intel.competitors WHERE is_active = TRUE ORDER BY name LIMIT $1 OFFSET $2`,
        [perPage, offset]
      ),
      pool().query(
        `SELECT COUNT(*) AS count FROM bmc_market_intel.competitors WHERE is_active = TRUE`
      ),
    ]);

    const total = parseInt(count.rows[0]?.count ?? '0', 10);
    res.json({
      data: data.rows,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    if (isNotProvisioned(err)) {
      log.warn({ err, route: 'GET /dashboard/competitors' }, 'market-intel not provisioned — serving empty payload');
      return res.json(emptyPage(page, perPage));
    }
    log.error({ err, route: 'GET /dashboard/competitors' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── GET /api/marketing/dashboard/alerts ──────────────────────────
router.get('/dashboard/alerts', requireAuth, async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '25', 10)));
  try {
    const offset  = (page - 1) * perPage;
    const level   = req.query.level;

    const params  = [perPage, offset];
    const clause  = level ? 'AND a.level = $3' : '';
    if (level) params.push(level);

    const [data, count] = await Promise.all([
      pool().query(
        `SELECT a.*, c.name AS competitor_name, c.domain
         FROM bmc_market_intel.alerts a
         JOIN bmc_market_intel.competitors c ON c.id = a.competitor_id
         WHERE 1=1 ${clause}
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      ),
      pool().query(
        `SELECT COUNT(*) AS count FROM bmc_market_intel.alerts WHERE 1=1 ${clause}`,
        level ? [level] : []
      ),
    ]);

    const total = parseInt(count.rows[0]?.count ?? '0', 10);
    res.json({
      data: data.rows,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    if (isNotProvisioned(err)) {
      log.warn({ err, route: 'GET /dashboard/alerts' }, 'market-intel not provisioned — serving empty payload');
      return res.json(emptyPage(page, perPage));
    }
    log.error({ err, route: 'GET /dashboard/alerts' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── GET /api/marketing/mystery-shopping ──────────────────────────
router.get('/mystery-shopping', requireAuth, async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '25', 10)));
  try {
    const { tasks, total } = await listPendingTasks(page, perPage);
    res.json({
      data: tasks,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    if (isNotProvisioned(err)) {
      log.warn({ err, route: 'GET /mystery-shopping' }, 'market-intel not provisioned — serving empty payload');
      return res.json(emptyPage(page, perPage));
    }
    log.error({ err, route: 'GET /mystery-shopping' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── PATCH /api/marketing/mystery-shopping/:id/status ─────────────
router.patch('/mystery-shopping/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, approved_by } = req.body;

  const valid = ['approved', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  try {
    const task = await updateTaskStatus(
      id,
      status,
      approved_by,
      status === 'completed' ? new Date() : undefined
    );

    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json(task);
  } catch (err) {
    log.error({ err, taskId: id }, 'status update failed');
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── POST /api/marketing/etl/run ──────────────────────────────────
router.post('/etl/run', requireAuth, (req, res) => {
  log.info({ userId: req.user?.id }, 'manual ETL trigger received');

  // Fire-and-forget — caller monitors via /dashboard/summary
  runEtl().catch(err => log.error({ err }, 'manual ETL run failed'));

  res.status(202).json({
    message: 'ETL run started',
    hint: 'Monitor status at GET /api/marketing/dashboard/summary',
  });
});

export default router;
