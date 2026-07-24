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
    report.meta.range_key = rangeKey;
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
