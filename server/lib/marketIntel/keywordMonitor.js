// Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-04
// Live keyword monitor: Google Autocomplete signals + Playwright SERP for BMC vs competitors.
// Persists to keywordMonitorState.json (always) and Postgres snapshots (when migrated).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import pino from 'pino';
import { getCompetitorMap } from './productIntelligence.js';
import {
  KeywordSerpSession,
  fetchSerpDomainsPlaywright,
  closeSharedSerpSession,
} from './keywordSerpPlaywright.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const STATE_PATH = process.env.KEYWORD_MONITOR_STATE_PATH || join(DATA_DIR, 'keywordMonitorState.json');
const SEEDS_PATH = process.env.KEYWORD_MONITOR_SEEDS_PATH || join(DATA_DIR, 'keywordSeeds.json');

const BMC_DOMAIN = 'bmcuruguay.com.uy';
const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';
const REFRESH_DELAY_MS = Number(process.env.KEYWORD_MONITOR_DELAY_MS ?? 400);
const SERP_BATCH_DELAY_MS = Number(process.env.KEYWORD_MONITOR_SERP_DELAY_MS ?? 2800);
const SERP_ENGINE = process.env.KEYWORD_MONITOR_SERP_ENGINE || 'playwright';

let _pool = null;
let refreshInFlight = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) return null;
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
};

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeDomain(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '');
}

function buildDomainIndex() {
  const map = getCompetitorMap();
  const byDomain = new Map();
  for (const row of map?.product_family_mapping || []) {
    if (!row.website) continue;
    try {
      const d = normalizeDomain(new URL(row.website).hostname);
      byDomain.set(d, row.competidor);
    } catch {
      /* skip invalid */
    }
  }
  byDomain.set('kingspan.com.uy', 'Kingspan Uruguay');
  byDomain.set('listado.mercadolibre.com.uy', 'MercadoLibre UY');
  byDomain.set('mercadolibre.com.uy', 'MercadoLibre UY');
  return byDomain;
}

export function volumeProxyFromCount(n) {
  if (n == null || n < 0) return 'unknown';
  if (n >= 8) return 'high';
  if (n >= 3) return 'medium';
  return 'low';
}

export function difficultyFromSerp(serpDomains, competitorDomains) {
  if (!serpDomains?.length) return 'unknown';
  let hits = 0;
  for (const d of serpDomains.slice(0, 10)) {
    if (competitorDomains.has(d) || d.includes('kingspan') || d.includes('mercadolibre')) hits++;
  }
  if (hits >= 6) return 'high';
  if (hits >= 3) return 'medium';
  return 'low';
}

export function findDomainPosition(domains, target) {
  const t = normalizeDomain(target);
  const idx = domains.findIndex((d) => normalizeDomain(d) === t || normalizeDomain(d).includes(t));
  return idx >= 0 ? idx + 1 : null;
}

export function parseDdgSerpDomains(html, limit = 10) {
  const domains = [];
  const seen = new Set();
  const re = /uddg=([^&"]+)/g;
  let m;
  while ((m = re.exec(html)) !== null && domains.length < limit) {
    try {
      const url = decodeURIComponent(m[1]);
      const host = normalizeDomain(new URL(url).hostname);
      if (!seen.has(host)) {
        seen.add(host);
        domains.push(host);
      }
    } catch {
      /* skip */
    }
  }
  return domains;
}

export async function fetchAutocompleteCount(query, { hl = 'es', gl = 'uy' } = {}) {
  const url = new URL(SUGGEST_URL);
  url.searchParams.set('client', 'firefox');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', hl);
  url.searchParams.set('gl', gl);
  const res = await fetch(url, { headers: { 'User-Agent': 'bmc-keyword-monitor/1.0' } });
  if (!res.ok) throw new Error(`autocomplete ${res.status}`);
  const text = await res.text();
  const parsed = JSON.parse(text);
  const suggestions = (parsed[1] || []).filter((s) => typeof s === 'string');
  return suggestions.length;
}

/** @deprecated DDG blocks bots — kept for tests only */
export async function fetchSerpDomainsDdg(query, { hl = 'es', gl = 'uy' } = {}) {
  const DDG_HTML = 'https://html.duckduckgo.com/html/';
  const body = new URLSearchParams({ q: query, kl: `${gl}-${hl}` });
  const res = await fetch(DDG_HTML, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; bmc-keyword-monitor/1.0)',
    },
    body,
  });
  if (!res.ok) throw new Error(`serp ${res.status}`);
  const html = await res.text();
  return parseDdgSerpDomains(html);
}

export async function fetchSerpDomains(query, opts = {}) {
  if (SERP_ENGINE === 'ddg') {
    const domains = await fetchSerpDomainsDdg(query, opts);
    return { domains, engine: 'ddg' };
  }
  return fetchSerpDomainsPlaywright(query, opts);
}

function initStateFromSeeds() {
  const seeds = loadJson(SEEDS_PATH);
  return {
    market: seeds.market,
    language: seeds.language,
    bmc_domain: seeds.bmc_domain || BMC_DOMAIN,
    last_refresh_at: null,
    last_refresh_status: null,
    keywords: seeds.keywords.map((k) => ({
      ...k,
      active: true,
      autocomplete_count: null,
      volume_proxy: 'unknown',
      difficulty: 'unknown',
      bmc_serp_position: null,
      bmc_serp_prev_position: null,
      position_delta: null,
      top_competitor_domain: null,
      top_competitor_name: null,
      serp_domains: [],
      captured_at: null,
      error: null,
    })),
  };
}

export function getKeywordMonitorState() {
  if (existsSync(STATE_PATH)) {
    try {
      return loadJson(STATE_PATH);
    } catch (err) {
      log.warn({ err }, 'corrupt keywordMonitorState.json — reseeding');
    }
  }
  const state = initStateFromSeeds();
  saveState(state);
  return state;
}

/** API/UI row shape (nested serp) from flat state keyword. */
export function formatKeywordRow(kw) {
  const competitors = (kw.serp_domains || []).map((domain, i) => ({
    position: i + 1,
    domain,
    url: `https://${domain}`,
  }));
  const stale = !!(kw.error && String(kw.error).startsWith('serp stale:'));
  const serpError = stale ? null : kw.error || null;

  return {
    id: kw.id,
    term: kw.keyword,
    keyword: kw.keyword,
    cluster: kw.cluster,
    family: kw.family,
    intent: kw.intent,
    priority: kw.priority,
    on_site_gap: kw.on_site_gap,
    active: kw.active !== false,
    autocomplete_count: kw.autocomplete_count,
    volume_proxy: kw.volume_proxy,
    difficulty: kw.difficulty,
    serp: {
      position: kw.bmc_serp_position ?? null,
      previous_position: kw.bmc_serp_prev_position ?? null,
      position_delta: kw.position_delta,
      engine: kw.serp_engine ?? null,
      competitors,
      fetched_at: kw.captured_at,
      error: serpError,
      stale,
    },
  };
}

export function markKeywordRefreshRunning() {
  const state = getKeywordMonitorState();
  state.last_refresh_status = 'running';
  state.last_refresh_error = null;
  saveState(state);
  return state;
}

export function markKeywordRefreshFailed(message) {
  const state = getKeywordMonitorState();
  state.last_refresh_at = new Date().toISOString();
  state.last_refresh_status = 'failed';
  state.last_refresh_error = message || 'refresh failed';
  saveState(state);
  return state;
}

export function isKeywordRefreshRunning() {
  return !!refreshInFlight;
}

export function startKeywordRefresh(options = {}) {
  if (refreshInFlight) {
    return { started: false, promise: refreshInFlight };
  }

  markKeywordRefreshRunning();
  refreshInFlight = runKeywordRefresh(options)
    .catch((err) => {
      try {
        markKeywordRefreshFailed(err?.message);
      } catch (markErr) {
        log.error({ err: markErr }, 'failed to mark keyword refresh as failed');
      }
      throw err;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return { started: true, promise: refreshInFlight };
}

async function persistSnapshotToDb(kw, snapshot) {
  const p = pool();
  if (!p) return;
  try {
    await p.query(
      `INSERT INTO bmc_market_intel.tracked_keywords
         (id, keyword, cluster, family, intent, priority, market, language, on_site_gap, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
       ON CONFLICT (id) DO UPDATE SET
         keyword = EXCLUDED.keyword,
         cluster = EXCLUDED.cluster,
         family = EXCLUDED.family,
         intent = EXCLUDED.intent,
         priority = EXCLUDED.priority,
         on_site_gap = EXCLUDED.on_site_gap,
         updated_at = NOW()`,
      [kw.id, kw.keyword, kw.cluster, kw.family, kw.intent, kw.priority, 'uy', 'es', !!kw.on_site_gap]
    );
    await p.query(
      `INSERT INTO bmc_market_intel.keyword_snapshots
         (keyword_id, autocomplete_count, volume_proxy, difficulty, bmc_serp_position, top_competitor_domain, serp_domains, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        kw.id,
        snapshot.autocomplete_count,
        snapshot.volume_proxy,
        snapshot.difficulty,
        snapshot.bmc_serp_position,
        snapshot.top_competitor_domain,
        JSON.stringify(snapshot.serp_domains || []),
        JSON.stringify({ position_delta: snapshot.position_delta, serp_engine: snapshot.serp_engine, error: snapshot.error }),
      ]
    );
  } catch (err) {
    log.debug({ err, keyword: kw.keyword }, 'DB keyword snapshot skipped');
  }
}

export async function refreshKeyword(kw, ctx) {
  const { domainIndex, competitorDomains, bmcDomain, serpSession } = ctx;
  const prevPos = kw.bmc_serp_position ?? null;
  const hadPriorSerp = (kw.serp_domains?.length ?? 0) > 0;
  let autocomplete_count = kw.autocomplete_count ?? null;
  let serp_domains = hadPriorSerp ? [...kw.serp_domains] : [];
  let serp_engine = kw.serp_engine ?? null;
  let captured_at = kw.captured_at ?? null;
  let error = null;
  let serpRefreshed = false;

  try {
    autocomplete_count = await fetchAutocompleteCount(kw.keyword, { hl: 'es', gl: 'uy' });
  } catch (err) {
    error = `autocomplete: ${err.message}`;
    log.warn({ err, keyword: kw.keyword }, 'autocomplete failed');
  }

  await sleep(REFRESH_DELAY_MS);

  try {
    const serp = await fetchSerpDomains(kw.keyword, { hl: 'es', gl: 'uy', session: serpSession });
    serp_domains = serp.domains;
    serp_engine = serp.engine;
    serpRefreshed = true;
    captured_at = new Date().toISOString();
    if (error?.startsWith('autocomplete:')) error = null;
  } catch (err) {
    const serpErr = err.message;
    if (!hadPriorSerp) {
      error = serpErr;
      captured_at = new Date().toISOString();
    } else {
      error = `serp stale: ${serpErr}`;
    }
    log.warn({ err, keyword: kw.keyword }, 'keyword SERP refresh failed — keeping prior snapshot');
  }

  const bmc_serp_position = serp_domains.length
    ? findDomainPosition(serp_domains, bmcDomain)
    : serpRefreshed
      ? null
      : prevPos;
  let top_competitor_domain = null;
  let top_competitor_name = null;
  for (const d of serp_domains) {
    if (d === bmcDomain) continue;
    if (domainIndex.has(d)) {
      top_competitor_domain = d;
      top_competitor_name = domainIndex.get(d);
      break;
    }
  }
  if (!top_competitor_domain && serp_domains.length) {
    const first = serp_domains.find((d) => d !== bmcDomain);
    if (first) {
      top_competitor_domain = first;
      top_competitor_name = domainIndex.get(first) || first;
    }
  }

  const snapshot = {
    autocomplete_count,
    volume_proxy: volumeProxyFromCount(autocomplete_count),
    difficulty: difficultyFromSerp(serp_domains, competitorDomains),
    bmc_serp_position,
    bmc_serp_prev_position: prevPos,
    position_delta: prevPos != null && bmc_serp_position != null ? prevPos - bmc_serp_position : null,
    top_competitor_domain,
    top_competitor_name,
    serp_domains,
    serp_engine,
    captured_at,
    error,
  };

  await persistSnapshotToDb(kw, snapshot);
  return { ...kw, ...snapshot, active: kw.active !== false };
}

export async function runKeywordRefresh({ ids = null, priority = null } = {}) {
  const state = getKeywordMonitorState();
  const domainIndex = buildDomainIndex();
  const competitorDomains = new Set(domainIndex.keys());
  const bmcDomain = state.bmc_domain || BMC_DOMAIN;
  const ctx = { domainIndex, competitorDomains, bmcDomain };

  let targets = state.keywords.filter((k) => k.active !== false);
  if (ids?.length) targets = targets.filter((k) => ids.includes(k.id));
  if (priority) targets = targets.filter((k) => k.priority === priority);

  const results = [];
  let errors = 0;
  let session = null;
  try {
    if (SERP_ENGINE !== 'ddg') {
      session = new KeywordSerpSession();
      await session.init();
      ctx.serpSession = session;
    }
    for (const kw of targets) {
      const updated = await refreshKeyword(kw, ctx);
      results.push(updated);
      if (updated.error && !updated.serp_domains?.length) errors++;
      await sleep(SERP_ENGINE !== 'ddg' ? SERP_BATCH_DELAY_MS : REFRESH_DELAY_MS);
    }
  } finally {
    if (session) await session.close();
    else await closeSharedSerpSession();
  }

  const byId = new Map(results.map((r) => [r.id, r]));
  const latestState = getKeywordMonitorState();
  latestState.keywords = latestState.keywords.map((k) => byId.get(k.id) || k);
  latestState.last_refresh_at = new Date().toISOString();
  latestState.last_refresh_status = errors === 0 ? 'success' : errors < targets.length ? 'partial' : 'failed';
  latestState.last_refresh_error = errors ? `${errors} keyword(s) failed` : null;
  saveState(latestState);

  log.info({ total: targets.length, errors, status: latestState.last_refresh_status }, 'keyword refresh complete');
  return latestState;
}

export async function addTrackedKeyword({ keyword, cluster, family, intent, priority, on_site_gap }) {
  const state = getKeywordMonitorState();
  const id = `kw-${Date.now()}`;
  const entry = {
    id,
    keyword: keyword.trim(),
    cluster: cluster || 'Custom',
    family: family || 'panel_otro',
    intent: intent || 'commercial',
    priority: priority || 'P3',
    on_site_gap: !!on_site_gap,
    active: true,
    autocomplete_count: null,
    volume_proxy: 'unknown',
    difficulty: 'unknown',
    bmc_serp_position: null,
    bmc_serp_prev_position: null,
    position_delta: null,
    top_competitor_domain: null,
    top_competitor_name: null,
    serp_domains: [],
    captured_at: null,
    error: null,
  };
  state.keywords.push(entry);
  saveState(state);
  return entry;
}

export async function getKeywordRefreshMeta() {
  const p = pool();
  if (!p) {
    const state = getKeywordMonitorState();
    return {
      last_refresh_at: state.last_refresh_at,
      keywords_tracked: state.keywords.filter((k) => k.active !== false).length,
      source: 'file',
    };
  }
  try {
    const { rows } = await p.query(`SELECT * FROM bmc_market_intel.v_last_keyword_refresh`);
    return { ...rows[0], source: 'db' };
  } catch {
    const state = getKeywordMonitorState();
    return {
      last_refresh_at: state.last_refresh_at,
      keywords_tracked: state.keywords.filter((k) => k.active !== false).length,
      source: 'file',
    };
  }
}