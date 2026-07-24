// Meta Marketing API client (Graph Insights) for BMC Meta Ads Live Report PR3.
// Pure Insights→DTO mapping is exported for unit tests; HTTP is injectable via fetchImpl.
// Account id and token come only from env/config — never hard-code production act_ ids.

export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Normalize account id to act_XXX form */
export function normalizeAdAccountId(accountId) {
  if (!accountId) return null;
  const s = String(accountId).trim();
  if (!s) return null;
  return s.startsWith('act_') ? s : `act_${s.replace(/^act_/, '')}`;
}

/**
 * Date range for Insights API from range_key.
 * @returns {{ since: string, until: string }}
 */
export function dateRangeFromKey(rangeKey, now = new Date()) {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const untilStr = until.toISOString().slice(0, 10);
  let since = new Date(until);
  const key = rangeKey || '30d';
  if (key === 'ytd') {
    since = new Date(Date.UTC(until.getUTCFullYear(), 0, 1));
  } else if (key === 'year') {
    since.setUTCDate(since.getUTCDate() - 364);
  } else if (key === '7d') {
    since.setUTCDate(since.getUTCDate() - 6);
  } else if (key === '90d') {
    since.setUTCDate(since.getUTCDate() - 89);
  } else {
    // 30d default
    since.setUTCDate(since.getUTCDate() - 29);
  }
  return { since: since.toISOString().slice(0, 10), until: untilStr };
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Prefer lead actions, then purchase, then total actions count */
export function pickResultsFromActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { results: null, result_type: null };
  }
  const byType = Object.fromEntries(actions.map((a) => [a.action_type, num(a.value)]));
  const leadKeys = [
    'lead',
    'onsite_conversion.lead_grouped',
    'onsite_conversion.messaging_conversation_started_7d',
    'offsite_conversion.fb_pixel_lead',
  ];
  for (const k of leadKeys) {
    if (byType[k] != null && byType[k] > 0) return { results: byType[k], result_type: 'lead' };
  }
  if (byType.purchase != null && byType.purchase > 0) {
    return { results: byType.purchase, result_type: 'purchase' };
  }
  if (byType['offsite_conversion.fb_pixel_purchase'] != null) {
    return { results: byType['offsite_conversion.fb_pixel_purchase'], result_type: 'purchase' };
  }
  if (byType.link_click != null) return { results: byType.link_click, result_type: 'link_click' };
  // sum numeric values as last resort
  const sum = actions.reduce((s, a) => s + (num(a.value) || 0), 0);
  return { results: sum > 0 ? sum : null, result_type: sum > 0 ? 'other' : null };
}

export function pickCplFromCostPerAction(costPerActionType, resultType) {
  if (!Array.isArray(costPerActionType)) return null;
  const byType = Object.fromEntries(costPerActionType.map((a) => [a.action_type, num(a.value)]));
  if (resultType === 'lead') {
    for (const k of ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']) {
      if (byType[k] != null) return byType[k];
    }
  }
  if (resultType === 'purchase') {
    if (byType.purchase != null) return byType.purchase;
    if (byType['offsite_conversion.fb_pixel_purchase'] != null) {
      return byType['offsite_conversion.fb_pixel_purchase'];
    }
  }
  return costPerActionType[0] ? num(costPerActionType[0].value) : null;
}

/**
 * Map raw Graph Insights rows → MetaAdsReport-shaped object (without rules/hash).
 * @param {{ accountInsights: object[], dailyInsights: object[], campaigns: object[], rangeKey: string, accountId: string, since: string, until: string }}
 */
export function mapGraphInsightsToReport({
  accountInsights = [],
  dailyInsights = [],
  campaigns = [],
  rangeKey = '30d',
  accountId,
  since,
  until,
  fetchedAt = new Date().toISOString(),
}) {
  const acc = accountInsights[0] || {};
  const spend = num(acc.spend);
  const impressions = num(acc.impressions);
  const clicks = num(acc.clicks);
  const reach = num(acc.reach);
  const frequency = num(acc.frequency);
  const { results, result_type } = pickResultsFromActions(acc.actions);
  let cpl = pickCplFromCostPerAction(acc.cost_per_action_type, result_type);
  if (cpl == null && spend != null && results != null && results > 0) {
    cpl = Math.round((spend / results) * 100) / 100;
  }
  const ctr = num(acc.ctr);
  const cpm = num(acc.cpm);
  const cpc = num(acc.cpc);

  const series = (dailyInsights || [])
    .map((row) => {
      const { results: r } = pickResultsFromActions(row.actions);
      return {
        date: row.date_start || row.date_stop,
        spend: num(row.spend) || 0,
        results: r || 0,
        impressions: num(row.impressions) || undefined,
        clicks: num(row.clicks) || undefined,
      };
    })
    .filter((s) => s.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const totalSpend = spend != null ? spend : series.reduce((s, x) => s + (x.spend || 0), 0);

  const campaignRows = (campaigns || []).map((c) => {
    const cSpend = num(c.spend);
    const { results: cRes, result_type: cType } = pickResultsFromActions(c.actions);
    let cCpl = pickCplFromCostPerAction(c.cost_per_action_type, cType);
    if (cCpl == null && cSpend != null && cRes != null && cRes > 0) {
      cCpl = Math.round((cSpend / cRes) * 100) / 100;
    }
    const statusRaw = String(c.campaign_status || c.effective_status || 'UNKNOWN').toUpperCase();
    let status = 'UNKNOWN';
    if (statusRaw === 'ACTIVE') status = 'ACTIVE';
    else if (statusRaw === 'PAUSED') status = 'PAUSED';
    else if (cSpend == null || cSpend === 0) status = 'ZOMBIE';
    return {
      id: String(c.campaign_id || c.id || c.campaign_name || Math.random()),
      name: c.campaign_name || c.name || 'Unnamed',
      objective: c.objective || 'unknown',
      status,
      spend: cSpend,
      results: cRes,
      cpl: cCpl,
      roas: null,
      ctr: num(c.ctr),
      impressions: num(c.impressions),
      clicks: num(c.clicks),
      share_of_spend:
        totalSpend > 0 && cSpend != null
          ? Math.round((cSpend / totalSpend) * 1000) / 10
          : null,
    };
  });

  const active = campaignRows.filter((c) => c.status === 'ACTIVE').length;
  const zombie = campaignRows.filter((c) => c.status === 'ZOMBIE').length;

  return {
    meta: {
      provider: 'meta',
      account_id: normalizeAdAccountId(accountId),
      currency: 'USD',
      date_start: since,
      date_stop: until,
      range_key: rangeKey,
      freshness: 'live',
      fetched_at: fetchedAt,
      source: 'graph_api',
      report_hash: '',
      notes: ['Live Meta Marketing API Insights'],
    },
    kpis: {
      spend,
      impressions,
      clicks,
      reach,
      frequency,
      results,
      result_type,
      cpl,
      roas: null,
      cost_per_result: cpl,
      ctr,
      cpm,
      cpc,
      deltas: null,
    },
    series,
    campaigns: campaignRows,
    platforms: [],
    placements: [],
    creatives: [],
    diagnostics: {
      total_campaigns: campaignRows.length || null,
      active: campaignRows.length ? active : null,
      zombie: campaignRows.length ? zombie : null,
      diagnostico: null,
      frequency_warning: typeof frequency === 'number' && frequency >= 3.5,
      notes: [],
    },
    recommendations: [],
  };
}

async function graphGet(url, { token, fetchImpl = fetch }) {
  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}access_token=${encodeURIComponent(token)}`;
  const res = await fetchImpl(full, { method: 'GET', headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Graph HTTP ${res.status}`);
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.graph = body?.error || body;
    throw err;
  }
  if (body?.error) {
    const err = new Error(body.error.message || 'Graph API error');
    err.status = 502;
    err.graph = body.error;
    throw err;
  }
  return body;
}

/**
 * Fetch live MetaAdsReport fragment from Graph.
 * @param {{ token: string, accountId: string, rangeKey?: string, fetchImpl?: typeof fetch }} opts
 */
export async function fetchLiveMetaAdsReport(opts) {
  const token = opts?.token;
  const accountId = normalizeAdAccountId(opts?.accountId);
  if (!token || token.length < 8) {
    const err = new Error('META_ADS_ACCESS_TOKEN not configured');
    err.status = 503;
    throw err;
  }
  if (!accountId) {
    const err = new Error('META_ADS_ACCOUNT_ID not configured');
    err.status = 503;
    throw err;
  }

  const rangeKey = opts.rangeKey || '30d';
  const { since, until } = dateRangeFromKey(rangeKey, opts.now);
  const fetchImpl = opts.fetchImpl || fetch;
  const fields =
    'spend,impressions,clicks,reach,frequency,ctr,cpm,cpc,actions,cost_per_action_type,campaign_id,campaign_name,objective';

  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const base = `${GRAPH_BASE}/${accountId}/insights`;

  const accountUrl = `${base}?level=account&time_range=${timeRange}&fields=${fields}`;
  const dailyUrl = `${base}?level=account&time_increment=1&time_range=${timeRange}&fields=spend,impressions,clicks,actions,date_start,date_stop`;
  const campaignUrl = `${base}?level=campaign&time_range=${timeRange}&fields=${fields},campaign_id,campaign_name,objective`;

  // Campaign status requires campaigns edge (insights may not include effective_status on all versions)
  const campaignsEdge = `${GRAPH_BASE}/${accountId}/campaigns?fields=id,name,status,objective,effective_status&limit=200`;

  const [accountBody, dailyBody, campaignBody, campListBody] = await Promise.all([
    graphGet(accountUrl, { token, fetchImpl }),
    graphGet(dailyUrl, { token, fetchImpl }),
    graphGet(campaignUrl, { token, fetchImpl }),
    graphGet(campaignsEdge, { token, fetchImpl }).catch(() => ({ data: [] })),
  ]);

  const statusById = {};
  for (const c of campListBody?.data || []) {
    statusById[String(c.id)] = c.effective_status || c.status;
  }
  const campaignInsights = (campaignBody?.data || []).map((row) => ({
    ...row,
    campaign_status: statusById[String(row.campaign_id)] || row.campaign_status,
  }));

  return mapGraphInsightsToReport({
    accountInsights: accountBody?.data || [],
    dailyInsights: dailyBody?.data || [],
    campaigns: campaignInsights,
    rangeKey,
    accountId,
    since,
    until,
  });
}

export function createMetaAdsClient({ token, accountId, fetchImpl } = {}) {
  return {
    fetchReport: (rangeKey) =>
      fetchLiveMetaAdsReport({
        token: token || process.env.META_ADS_ACCESS_TOKEN,
        accountId: accountId || process.env.META_ADS_ACCOUNT_ID,
        rangeKey,
        fetchImpl,
      }),
  };
}
