// Meta Ads report orchestrator — multi-source MetaAdsReport DTO.
// PR1: demo fixture + snapshot. PR3: live Graph when META_ADS_* configured.

import { getAdsIntelligence } from './productIntelligence.js';
import { mapSnapshotToReport, hashReport } from './metaAdsSnapshotMapper.js';
import { loadMetaAdsFixture } from './metaAdsFixture.js';
import { buildRulesRecommendations } from './metaAdsRules.js';

const VALID_RANGE = new Set(['7d', '30d', '90d', 'ytd', 'year']);
const VALID_SOURCE = new Set(['auto', 'live', 'demo', 'snapshot']);

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
  return {
    token_configured: Boolean(token && token.length > 8),
    account_configured: Boolean(accountId),
    account_id: accountId || null,
    // Never expose token
  };
}

/**
 * Resolve source for Auto:
 * - production: live (if token) → snapshot (never demo)
 * - development: prefer demo for rich UI when no token, else snapshot
 */
export function resolveSource(requested, { nodeEnv = process.env.NODE_ENV } = {}) {
  if (requested !== 'auto') return requested;
  const cfg = metaAdsConfig();
  if (cfg.token_configured && cfg.account_configured) return 'live';
  if (nodeEnv !== 'production') return 'demo';
  return 'snapshot';
}

/**
 * Build MetaAdsReport for range + source.
 * @returns {{ report: object, resolved_source: string }}
 */
export function buildMetaAdsReport({ range = '30d', source = 'auto' } = {}) {
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
  let report;

  if (resolved === 'demo') {
    report = loadMetaAdsFixture();
    report.meta.range_key = rangeKey;
  } else if (resolved === 'live') {
    // PR3 not implemented — fail open to snapshot with note
    const ads = getAdsIntelligence();
    report = mapSnapshotToReport(ads, rangeKey);
    report.meta.notes = [
      ...(report.meta.notes || []),
      'Live Graph no implementado aún (PR3) — sirviendo snapshot como fallback',
    ];
    report.meta.freshness = 'snapshot';
    report.meta.source = 'adsIntelligence.json';
  } else {
    // snapshot
    const ads = getAdsIntelligence();
    if (!ads) {
      const err = new Error('Market intel data unavailable');
      err.status = 503;
      throw err;
    }
    report = mapSnapshotToReport(ads, rangeKey);
  }

  // Attach rules recommendations (replace empty list; keep any fixture rules then merge)
  const rules = buildRulesRecommendations(report);
  const existingAi = (report.recommendations || []).filter((r) => r.source === 'ai');
  report.recommendations = [...rules, ...existingAi];

  report.meta.report_hash = hashReport(report);
  return { report, resolved_source: resolved };
}

export function buildMetaAdsHealth() {
  const cfg = metaAdsConfig();
  return {
    token_configured: cfg.token_configured,
    account_configured: cfg.account_configured,
    last_success_at: null,
    cache_age_s: null,
    mode: cfg.token_configured ? 'live_ready_pr3' : 'snapshot_or_demo',
    graph_api_version: 'v21.0',
    live_implemented: false,
  };
}
