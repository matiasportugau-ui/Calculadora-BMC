// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Mount in server/index.js:
//   import marketingRouter from './routes/marketing.js';
//   app.use('/api/marketing', marketingRouter);

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import pino from 'pino';
import { requireServiceOrUser } from '../middleware/requireServiceOrUser.js';

const requireMarketing = requireServiceOrUser({ role: 'admin' });
import { listPendingTasks, updateTaskStatus } from '../lib/marketIntel/mysteryShoppingQueue.js';
import { runEtl } from '../lib/marketIntel/etl/runner.js';
import { generateStrategicBrief } from '../lib/marketIntel/strategicBrief.js';
import {
  getBaselinePrices,
  getCompetitorMap,
  getAdsIntelligence,
  getMlPulse,
  getEtlSummary,
} from '../lib/marketIntel/productIntelligence.js';
import { buildProductMatrix } from '../lib/marketIntel/priceGap.js';
import {
  getKeywordMonitorState,
  formatKeywordRow,
  markKeywordRefreshRunning,
  isKeywordRefreshRunning,
  runKeywordRefresh,
  addTrackedKeyword,
  getKeywordRefreshMeta,
} from '../lib/marketIntel/keywordMonitor.js';
import { callAgentOnce } from '../lib/agentCore.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const router = Router();

let _pool = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
};

// ─── GET /api/marketing/dashboard/summary ─────────────────────────
router.get('/dashboard/summary', requireMarketing, async (req, res) => {
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
    log.error({ err, route: 'GET /dashboard/summary' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── GET /api/marketing/dashboard/competitors ─────────────────────
router.get('/dashboard/competitors', requireMarketing, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '25', 10)));
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
    log.error({ err, route: 'GET /dashboard/competitors' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── GET /api/marketing/dashboard/alerts ──────────────────────────
router.get('/dashboard/alerts', requireMarketing, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '25', 10)));
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
    log.error({ err, route: 'GET /dashboard/alerts' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── GET /api/marketing/mystery-shopping ──────────────────────────
router.get('/mystery-shopping', requireMarketing, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '25', 10)));

    const { tasks, total } = await listPendingTasks(page, perPage);
    res.json({
      data: tasks,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    });
  } catch (err) {
    log.error({ err, route: 'GET /mystery-shopping' }, 'query failed');
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ─── PATCH /api/marketing/mystery-shopping/:id/status ─────────────
router.patch('/mystery-shopping/:id/status', requireMarketing, async (req, res) => {
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
router.post('/etl/run', requireMarketing, (req, res) => {
  log.info({ userId: req.user?.id }, 'manual ETL trigger received');

  // Fire-and-forget — caller monitors via /dashboard/summary
  runEtl().catch(err => log.error({ err }, 'manual ETL run failed'));

  res.status(202).json({
    message: 'ETL run started',
    hint: 'Monitor status at GET /api/marketing/dashboard/summary',
  });
});

// ─── POST /api/marketing/ai/brief ────────────────────────────────────
router.post('/ai/brief', requireMarketing, async (req, res) => {
  try {
    const brief = await generateStrategicBrief();
    if (brief.error) {
      return res.status(502).json({ error: brief.error, generated_at: brief.generated_at });
    }
    res.json(brief);
  } catch (err) {
    log.error({ err, route: 'POST /ai/brief' }, 'strategic brief failed');
    res.status(503).json({ error: 'Brief generation failed' });
  }
});

// ─── GET /api/marketing/product-intelligence ─────────────────────────
router.get('/product-intelligence', requireMarketing, async (req, res) => {
  try {
    const { getEtlSummary, getPriceHistory, getRecentAlerts, PRODUCT_CATEGORIES } =
      await import('../lib/marketIntel/productIntelligence.js');
    const [summary, recentAlerts, priceHistory] = await Promise.all([
      getEtlSummary(),
      getRecentAlerts(),
      getPriceHistory(7),
    ]);
    res.json({ categories: PRODUCT_CATEGORIES, summary, recent_alerts: recentAlerts, price_history: priceHistory });
  } catch (err) {
    log.error({ err, route: 'GET /product-intelligence' }, 'product intel failed');
    res.status(503).json({ error: 'Product intelligence unavailable' });
  }
});

// Per-IP rate limiter for the new intel surfaces (matches mlSearch.js convention).
const intelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── GET /api/marketing/intel ────────────────────────────────────────
// Surfaces the offline market investigation (competitor map, Meta Ads audit,
// MercadoLibre pulse) captured under server/lib/marketIntel/data/. Static data
// so this is cheap; still degrade to 503 if a loader throws.
router.get('/intel', intelLimiter, requireMarketing, (req, res) => {
  try {
    res.json({
      competitors: getCompetitorMap(),
      ads: getAdsIntelligence(),
      ml: getMlPulse(),
    });
  } catch (err) {
    log.error({ err, route: 'GET /intel' }, 'intel load failed');
    res.status(503).json({ error: 'Market intel data unavailable' });
  }
});

// ─── GET /api/marketing/product-matrix ───────────────────────────────
// BMC baseline SKUs vs a tier-weighted competitor market reference + Δ% +
// positioning. The reference is an estimate (see priceGap.js), not a live quote.
router.get('/product-matrix', intelLimiter, requireMarketing, (req, res) => {
  try {
    const rows = buildProductMatrix(getBaselinePrices(), getCompetitorMap());
    res.json({
      data: rows,
      reference_basis: 'tier_weighted_estimate',
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    log.error({ err, route: 'GET /product-matrix' }, 'product matrix failed');
    res.status(503).json({ error: 'Product matrix unavailable' });
  }
});

// ─── GET /api/marketing/keywords ─────────────────────────────────────
router.get('/keywords', intelLimiter, requireMarketing, async (req, res) => {
  try {
    const state = getKeywordMonitorState();
    const meta = await getKeywordRefreshMeta();
    const priority = req.query.priority;
    let keywords = state.keywords.filter((k) => k.active !== false);
    if (priority) keywords = keywords.filter((k) => k.priority === priority);
    res.json({
      market: state.market,
      bmc_domain: state.bmc_domain,
      serp_engine: process.env.KEYWORD_MONITOR_SERP_ENGINE || 'playwright',
      last_refresh_at: state.last_refresh_at || meta?.last_refresh_at,
      last_refresh_status: state.last_refresh_status,
      keywords: keywords.map(formatKeywordRow),
      total: keywords.length,
    });
  } catch (err) {
    log.error({ err, route: 'GET /keywords' }, 'keyword monitor load failed');
    res.status(503).json({ error: 'Keyword monitor unavailable' });
  }
});

// ─── POST /api/marketing/keywords ────────────────────────────────────
router.post('/keywords', intelLimiter, requireMarketing, async (req, res) => {
  const { cluster, family, intent, priority, on_site_gap } = req.body || {};
  const keyword = req.body?.keyword ?? req.body?.term;
  if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
    return res.status(400).json({ error: 'keyword required' });
  }
  try {
    const entry = await addTrackedKeyword({ keyword, cluster, family, intent, priority, on_site_gap });
    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof TypeError) {
      return res.status(400).json({ error: err.message });
    }
    log.error({ err, route: 'POST /keywords' }, 'add keyword failed');
    res.status(503).json({ error: 'Could not add keyword' });
  }
});

// ─── POST /api/marketing/keywords/refresh ────────────────────────────
// Fire-and-forget (Playwright SERP can take several minutes). Poll GET /keywords.
router.post('/keywords/refresh', intelLimiter, requireMarketing, (req, res) => {
  const { ids, priority } = req.body || {};
  log.info({ userId: req.user?.id, ids, priority }, 'keyword refresh triggered');

  if (isKeywordRefreshRunning()) {
    return res.status(409).json({
      error: 'keyword_refresh_running',
      message: 'A keyword refresh is already running. Poll GET /api/marketing/keywords.',
    });
  }

  markKeywordRefreshRunning();

  runKeywordRefresh({
    ids: Array.isArray(ids) ? ids : null,
    priority: priority || null,
  }).catch((err) => log.error({ err }, 'keyword refresh background run failed'));

  res.status(202).json({
    message: 'Keyword refresh started',
    hint: 'Poll GET /api/marketing/keywords until last_refresh_at updates',
  });
});

// ─── POST /api/marketing/ai/chat (SSE) ───────────────────────────────
// Market-scoped chat. Injects the full offline + live intel as context and
// streams the answer in the same `data: {type,...}` shape the frontend SSE
// reader already understands (see useChat.js).
const MARKET_CHAT_SYSTEM_PROMPT = `Eres "Market Intel AI", el analista de inteligencia de mercado de BMC Uruguay (paneles aislantes para techo y pared). Respondés preguntas sobre competencia, precios, posicionamiento, campañas (Meta Ads) y MercadoLibre, SIEMPRE basándote en los datos de contexto entregados abajo. Sé concreto y accionable; máximo ~6 oraciones o una lista corta. Si la pregunta excede los datos disponibles, decilo y sugerí qué dato haría falta. Respondé en español rioplatense, sin markdown excesivo. Los precios están en USD por m² sin IVA.`;

async function buildMarketChatContext() {
  const compMap = getCompetitorMap();
  const ads = getAdsIntelligence();
  const ml = getMlPulse();
  const prices = getBaselinePrices();

  const tier1 = (compMap?.product_family_mapping || [])
    .filter((c) => c.tier === 1)
    .map((c) => `${c.competidor} (${c.type}, ${c.familia_principal})`)
    .join('; ');
  const tierCounts = Object.entries(compMap?.tiers || {})
    .map(([t, v]) => `T${t} ${v.label}: ${v.count}`)
    .join(' · ');

  const priceLines = (prices || [])
    .map((p) => `- ${p.producto} ${p.espesor_mm}mm (${p.nucleo}): USD ${p.precio_publico_usd_m2 ?? 'cotización'}/m²`)
    .join('\n');

  const angles = (ads?.ad_copy_angles || []).map((a) => `${a.nombre} ("${a.headline}")`).join('; ');
  const tendencias = (ml?.tendencias_mercado || []).map((t) => `${t.indicador}: ${t.tendencia}`).join('; ');

  let liveLine = 'Sin datos ETL en vivo.';
  try {
    const summary = await getEtlSummary();
    const e = summary?.last_etl_run;
    const a = summary?.alert_counts;
    const parts = [];
    if (e) parts.push(`Último ETL ${e.status} (${e.competitors_succeeded}/${e.competitors_attempted})`);
    if (a) parts.push(`alertas 24h: ${a.critical} críticas/${a.warning} warn/${a.info} info`);
    if (parts.length) liveLine = parts.join(', ') + '.';
  } catch {
    /* DB unavailable — keep static intel only */
  }

  return `### Competidores (${compMap?.total_competidores ?? '?'} conocidos)
Tiers: ${tierCounts || 'n/d'}
Tier 1 (críticos): ${tier1 || 'n/d'}
Insight: el ecosistema Kingspan (Bromyros + MontFrío) domina EPS/PIR; los resellers MLU (Tier 5) presionan precio en EPS 50mm pared.

### Precios base BMC (catálogo público, USD/m² sin IVA)
${priceLines}

### Meta Ads
${ads?.total_campanas ?? '?'} campañas, ${ads?.campanas_activas ?? '?'} activas / ${ads?.campanas_zombie ?? '?'} zombies. Inversión: USD ${ads?.inversion_total_mensual_usd ?? '?'}/mes. Diagnóstico: ${ads?.diagnostico ?? 'n/d'}. Ángulos de copy: ${angles || 'n/d'}.

### MercadoLibre Uruguay
${ml?.metricas?.total_listings_activos ?? '?'} listings, ${ml?.metricas?.preguntas_sin_respuesta ?? '?'} preguntas sin responder (tasa ${ml?.metricas?.tasa_respuesta ?? 'n/d'}). Tendencias: ${tendencias || 'n/d'}.

### Estado en vivo
${liveLine}`;
}

router.post('/ai/chat', intelLimiter, requireMarketing, async (req, res) => {
  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!incoming || incoming.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }
  const messages = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'last message must be from user' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Heartbeat + client-close handling so the connection survives proxy idle
  // timeouts during the LLM call and nothing keeps writing after disconnect.
  let closed = false;
  const send = (obj) => {
    if (closed) return;
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* client disconnected */ }
  };
  const heartbeat = setInterval(() => {
    if (closed) return;
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 15000);
  // Listen on the RESPONSE close, not req: on a POST the request 'close' can fire
  // once the body is fully read (before the LLM call finishes), which would
  // suppress every write. res 'close' only fires on real client disconnect / end.
  res.on('close', () => { closed = true; clearInterval(heartbeat); });

  try {
    const context = await buildMarketChatContext();
    const systemPrompt = `${MARKET_CHAT_SYSTEM_PROMPT}\n\n## CONTEXTO DE MERCADO (datos vigentes)\n${context}`;
    const result = await callAgentOnce(messages, {
      channel: 'chat',
      systemPrompt,
      override: { maxTokens: 1500, temperature: 0.4 },
    });
    const text = (result?.text || '').trim() || 'No pude generar una respuesta con los datos disponibles.';
    send({ type: 'text', delta: text });
    send({ type: 'meta', provider: result?.provider || null, model: result?.model || null });
    send({ type: 'done' });
    if (!closed) res.end();
  } catch (err) {
    log.error({ err, route: 'POST /ai/chat' }, 'market chat failed');
    send({ type: 'error', message: 'No se pudo contactar al analista AI. Reintentá en unos segundos.' });
    send({ type: 'done' });
    if (!closed) res.end();
  } finally {
    clearInterval(heartbeat);
  }
});

export default router;
