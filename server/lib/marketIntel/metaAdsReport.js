// Meta Ads report orchestrator — multi-source MetaAdsReport DTO.
// PR1: demo fixture + snapshot. PR3: live Graph when META_ADS_* configured.
// buildMetaAdsReport is always async (await Graph when live).

import { getAdsIntelligence } from './productIntelligence.js';
import { mapSnapshotToReport, hashReport } from './metaAdsSnapshotMapper.js';
import { loadMetaAdsFixture } from './metaAdsFixture.js';
import { buildRulesRecommendations } from './metaAdsRules.js';
import {
  fetchLiveMetaAdsReport,
  GRAPH_API_VERSION,
  normalizeAdAccountId,
} from '../metaAdsClient.js';

const VALID_RANGE = new Set(['7d', '30d', '90d', 'ytd', 'year']);
const VALID_SOURCE = new Set(['auto', 'live', 'demo', 'snapshot']);

/** Optional injectors for tests */
let _liveFetch = fetchLiveMetaAdsReport;
let _lastLiveSuccessAt = null;

export function setLiveFetchImpl(fn) {
  _liveFetch = fn || fetchLiveMetaAdsReport;
}

export function resetLiveFetchImpl() {
  _liveFetch = fetchLiveMetaAdsReport;
}

function round(n, digits = 2) {
  if (n == null || !Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function scaleMetric(value, factor) {
  if (value == null || !Number.isFinite(Number(value))) return value ?? null;
  return round(Number(value) * factor, 2);
}

/**
 * Build a date window anchored to the fixture's last series day (not wall-clock
 * "today"), so default 30d keeps the full demo and 7d genuinely shortens it.
 */
function demoDateRange(rangeKey, fullSeries, fallbackMeta = {}) {
  const stopStr =
    fullSeries[fullSeries.length - 1]?.date ||
    fallbackMeta.date_stop ||
    new Date().toISOString().slice(0, 10);
  const stop = new Date(`${stopStr}T00:00:00.000Z`);
  let start;
  if (rangeKey === 'ytd') {
    start = `${stop.getUTCFullYear()}-01-01`;
  } else {
    const days = { '7d': 7, '30d': 30, '90d': 90, year: 365 }[rangeKey] || 30;
    const s = new Date(stop);
    s.setUTCDate(s.getUTCDate() - (days - 1));
    start = s.toISOString().slice(0, 10);
  }
  return { date_start: start, date_stop: stopStr, range_key: rangeKey };
}

/**
 * Slice demo fixture to the requested calendar range and recompute KPIs from series.
 * Prevents range_key=7d from still showing full 30d fixture spend/dates.
 */
export function applyDemoRange(report, rangeKey) {
  const fullSeries = Array.isArray(report.series) ? [...report.series] : [];
  fullSeries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const range = demoDateRange(rangeKey, fullSeries, report.meta || {});
  const series = fullSeries.filter(
    (p) => p?.date && p.date >= range.date_start && p.date <= range.date_stop,
  );
  const baseSpend = fullSeries.reduce((a, p) => a + (Number(p.spend) || 0), 0);
  const spend = series.reduce((a, p) => a + (Number(p.spend) || 0), 0);
  const results = series.reduce((a, p) => a + (Number(p.results) || 0), 0);
  const impressions = series.reduce((a, p) => a + (Number(p.impressions) || 0), 0);
  const clicks = series.reduce((a, p) => a + (Number(p.clicks) || 0), 0);
  const factor = baseSpend > 0 ? spend / baseSpend : 0;
  const sliced = series.length !== fullSeries.length;

  const kpis = { ...(report.kpis || {}) };
  kpis.spend = round(spend, 2);
  kpis.results = results;
  kpis.impressions = impressions || null;
  kpis.clicks = clicks || null;
  kpis.cpl = results > 0 ? round(spend / results, 2) : null;
  kpis.cost_per_result = kpis.cpl;
  kpis.ctr = impressions > 0 ? round((clicks / impressions) * 100, 2) : null;
  kpis.cpm = impressions > 0 ? round((spend / impressions) * 1000, 2) : null;
  kpis.cpc = clicks > 0 ? round(spend / clicks, 2) : null;
  // Prior-period deltas in the fixture are for the full window — drop when sliced.
  if (sliced) kpis.deltas = null;
  if (kpis.reach != null && factor > 0 && sliced) {
    kpis.reach = Math.round(Number(kpis.reach) * factor);
  }

  const scaleRow = (row) => {
    if (!row || typeof row !== 'object' || !sliced) return row;
    const next = { ...row };
    if (next.spend != null) next.spend = scaleMetric(next.spend, factor);
    if (next.results != null) next.results = Math.round(Number(next.results) * factor);
    if (next.impressions != null) next.impressions = Math.round(Number(next.impressions) * factor);
    if (next.clicks != null) next.clicks = Math.round(Number(next.clicks) * factor);
    if (next.spend != null && next.results > 0) next.cpl = round(next.spend / next.results, 2);
    else if (next.cpl != null && factor === 0) next.cpl = null;
    return next;
  };

  report.meta = {
    ...(report.meta || {}),
    date_start: range.date_start,
    date_stop: range.date_stop,
    range_key: range.range_key,
  };
  report.series = series;
  report.kpis = kpis;
  report.campaigns = (report.campaigns || []).map(scaleRow);
  report.platforms = (report.platforms || []).map(scaleRow);
  report.placements = (report.placements || []).map(scaleRow);
  report.creatives = (report.creatives || []).map(scaleRow);
  if (sliced) {
    report.meta.notes = [
      ...(report.meta.notes || []),
      `Demo recortado a ${range.range_key} (${series.length} días de serie)`,
    ];
  }
  return report;
}

export function normalizeRange(range) {
  const r = String(range || '30d').toLowerCase();
  return VALID_RANGE.has(r) ? r : null;
}

export function normalizeSource(source) {
  const s = String(source || 'auto').toLowerCase();
  return VALID_SOURCE.has(s) ? s : null;
}

export function metaAdsConfig() {
  const token = process.env.META_ADS_ACCESS_TOKEN || '';
  const accountId = process.env.META_ADS_ACCOUNT_ID || '';
  const normalized = normalizeAdAccountId(accountId);
  return {
    token_configured: Boolean(token && token.length > 8),
    account_configured: Boolean(normalized),
    account_id: normalized,
    // Never expose token
  };
}

/**
 * Resolve source for Auto:
 * - live if token+account configured
 * - production without token → snapshot (never demo)
 * - development without token → demo
 */
export function resolveSource(requested, { nodeEnv = process.env.NODE_ENV } = {}) {
  if (requested !== 'auto') return requested;
  const cfg = metaAdsConfig();
  if (cfg.token_configured && cfg.account_configured) return 'live';
  if (nodeEnv !== 'production') return 'demo';
  return 'snapshot';
}

function attachRulesAndHash(report) {
  const rules = buildRulesRecommendations(report);
  const existingAi = (report.recommendations || []).filter((r) => r.source === 'ai');
  report.recommendations = [...rules, ...existingAi];
  report.meta.report_hash = hashReport(report);
  return report;
}

function snapshotReport(rangeKey, extraNotes = []) {
  const ads = getAdsIntelligence();
  if (!ads) {
    const err = new Error('Market intel data unavailable');
    err.status = 503;
    throw err;
  }
  const report = mapSnapshotToReport(ads, rangeKey);
  if (extraNotes.length) {
    report.meta.notes = [...(report.meta.notes || []), ...extraNotes];
  }
  if (report.meta.freshness === 'live') report.meta.freshness = 'snapshot';
  return attachRulesAndHash(report);
}

/**
 * Build MetaAdsReport for range + source (always Promise).
 * Live: Graph when credentials present; fail open to snapshot — never false LIVE.
 */
export async function buildMetaAdsReport({ range = '30d', source = 'auto', fetchImpl } = {}) {
  const rangeKey = normalizeRange(range);
  if (!rangeKey) {
    const err = new Error('invalid range');
    err.status = 400;
    throw err;
  }
  const sourceKey = normalizeSource(source);
  if (!sourceKey) {
    const err = new Error('invalid source');
    err.status = 400;
    throw err;
  }

  const resolved = resolveSource(sourceKey);

  if (resolved === 'demo') {
    const report = loadMetaAdsFixture();
    applyDemoRange(report, rangeKey);
    return { report: attachRulesAndHash(report), resolved_source: 'demo' };
  }

  if (resolved === 'live') {
    return buildLiveOrFallback(rangeKey, fetchImpl);
  }

  return { report: snapshotReport(rangeKey), resolved_source: 'snapshot' };
}

async function buildLiveOrFallback(rangeKey, fetchImpl) {
  const cfg = metaAdsConfig();
  if (!cfg.token_configured || !cfg.account_configured) {
    return {
      report: snapshotReport(rangeKey, [
        'Live solicitado pero META_ADS_ACCESS_TOKEN / META_ADS_ACCOUNT_ID no configurados — Snapshot',
      ]),
      resolved_source: 'snapshot',
    };
  }

  try {
    const live = await _liveFetch({
      token: process.env.META_ADS_ACCESS_TOKEN,
      accountId: cfg.account_id,
      rangeKey,
      fetchImpl,
    });
    if (!live || live.meta?.freshness !== 'live') {
      return {
        report: snapshotReport(rangeKey, [
          'Live Graph devolvió payload sin freshness live — Snapshot',
        ]),
        resolved_source: 'snapshot',
      };
    }
    _lastLiveSuccessAt = new Date().toISOString();
    return {
      report: attachRulesAndHash(live),
      resolved_source: 'live',
    };
  } catch (err) {
    const msg = err?.message || 'Graph error';
    return {
      report: snapshotReport(rangeKey, [
        `Live Graph falló (${msg}) — sirviendo Snapshot (fail-open)`,
      ]),
      resolved_source: 'snapshot',
    };
  }
}

export function buildMetaAdsHealth() {
  const cfg = metaAdsConfig();
  const liveReady = cfg.token_configured && cfg.account_configured;
  const health = {
    token_configured: cfg.token_configured,
    account_configured: cfg.account_configured,
    account_id: cfg.account_id,
    last_success_at: _lastLiveSuccessAt,
    cache_age_s: null,
    mode: liveReady ? 'live_ready' : 'snapshot_or_demo',
    graph_api_version: GRAPH_API_VERSION,
    live_implemented: true,
  };
  // Guard: never attach token-like fields
  if ('access_token' in health || 'token' in health) {
    delete health.access_token;
    delete health.token;
  }
  return health;
}
