// Unit tests — Meta Ads PR3 Live Graph (real builder + pure mapper; mocked Graph HTTP).
// Run: node tests/market-intel/metaAdsLive.test.js

import {
  mapGraphInsightsToReport,
  pickResultsFromActions,
  normalizeAdAccountId,
  dateRangeFromKey,
  GRAPH_API_VERSION,
} from '../../server/lib/metaAdsClient.js';
import {
  buildMetaAdsReport,
  buildMetaAdsHealth,
  setLiveFetchImpl,
  resetLiveFetchImpl,
  metaAdsConfig,
  resolveSource,
} from '../../server/lib/marketIntel/metaAdsReport.js';

let passed = 0;
let failed = 0;
function assert(name, cond, actual) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`, actual !== undefined ? `— ${JSON.stringify(actual)}` : '');
    failed += 1;
  }
}

console.log('\n═══ metaAdsLive PR3 ═══');

// --- pure mapper ---
const mapped = mapGraphInsightsToReport({
  accountInsights: [{
    spend: '1500.50',
    impressions: '100000',
    clicks: '1200',
    reach: '50000',
    frequency: '2.1',
    ctr: '1.2',
    cpm: '15',
    cpc: '1.25',
    actions: [{ action_type: 'lead', value: '25' }],
    cost_per_action_type: [{ action_type: 'lead', value: '60.02' }],
  }],
  dailyInsights: [
    { date_start: '2026-07-01', spend: '100', actions: [{ action_type: 'lead', value: '2' }], impressions: '1000', clicks: '10' },
    { date_start: '2026-07-02', spend: '120', actions: [{ action_type: 'lead', value: '3' }], impressions: '1100', clicks: '12' },
  ],
  campaigns: [
    {
      campaign_id: '111',
      campaign_name: 'Lead Gen Live',
      objective: 'OUTCOME_LEADS',
      spend: '900',
      actions: [{ action_type: 'lead', value: '15' }],
      cost_per_action_type: [{ action_type: 'lead', value: '60' }],
      ctr: '1.1',
      campaign_status: 'ACTIVE',
    },
    {
      campaign_id: '222',
      campaign_name: 'Paused Old',
      objective: 'OUTCOME_TRAFFIC',
      spend: '0',
      campaign_status: 'PAUSED',
    },
  ],
  rangeKey: '30d',
  accountId: '12345',
  since: '2026-06-23',
  until: '2026-07-22',
});

assert('mapper freshness live', mapped.meta.freshness === 'live');
assert('mapper source graph_api', mapped.meta.source === 'graph_api');
assert('mapper normalizes act_ prefix', mapped.meta.account_id === 'act_12345');
assert('mapper spend', mapped.kpis.spend === 1500.5);
assert('mapper results lead', mapped.kpis.results === 25 && mapped.kpis.result_type === 'lead');
assert('mapper cpl', mapped.kpis.cpl === 60.02);
assert('mapper series length', mapped.series.length === 2);
assert('mapper campaigns', mapped.campaigns.length === 2);
assert('mapper active campaign', mapped.campaigns[0].status === 'ACTIVE');
assert('pickResults lead', pickResultsFromActions([{ action_type: 'lead', value: '3' }]).results === 3);
assert('normalizeAdAccountId passthrough', normalizeAdAccountId('act_9') === 'act_9');
assert('dateRange 30d', (() => {
  const r = dateRangeFromKey('30d', new Date('2026-07-22T12:00:00Z'));
  return r.until === '2026-07-22' && r.since === '2026-06-23';
})());
assert('graph version string', typeof GRAPH_API_VERSION === 'string' && GRAPH_API_VERSION.startsWith('v'));

// --- builder with mocked live fetch (success) ---
const prevTok = process.env.META_ADS_ACCESS_TOKEN;
const prevAct = process.env.META_ADS_ACCOUNT_ID;
process.env.META_ADS_ACCESS_TOKEN = 'test-token-not-real-but-long-enough';
process.env.META_ADS_ACCOUNT_ID = 'act_999888777';

setLiveFetchImpl(async () => mapped);

const liveOk = await buildMetaAdsReport({ range: '30d', source: 'live' });
assert('live success freshness', liveOk.report.meta.freshness === 'live');
assert('live success resolved_source', liveOk.resolved_source === 'live');
assert('live success spend from mock', liveOk.report.kpis.spend === 1500.5);
assert('live success campaigns filled', liveOk.report.campaigns.length >= 1);
assert('live success has report_hash', liveOk.report.meta.report_hash.length >= 8);
assert('live success rules attached', Array.isArray(liveOk.report.recommendations));

// Graph error → fail open snapshot, never live
setLiveFetchImpl(async () => {
  const err = new Error('Simulated Graph 500');
  err.status = 500;
  throw err;
});
const liveFail = await buildMetaAdsReport({ range: '30d', source: 'live' });
assert('live fail not freshness live', liveFail.report.meta.freshness !== 'live', liveFail.report.meta.freshness);
assert('live fail notes mention Graph', (liveFail.report.meta.notes || []).some((n) => /Graph|falló|Snapshot/i.test(n)));
assert('live fail resolved snapshot', liveFail.resolved_source === 'snapshot');

const liveFail7 = await buildMetaAdsReport({ range: '7d', source: 'live' });
assert('live fail-open 7d not freshness live', liveFail7.report.meta.freshness !== 'live');
assert('live fail-open 7d spend null', liveFail7.report.kpis.spend === null, liveFail7.report.kpis.spend);
assert('live fail-open 7d range_key', liveFail7.report.meta.range_key === '7d');

// Missing token → not live even if source=live
delete process.env.META_ADS_ACCESS_TOKEN;
delete process.env.META_ADS_ACCOUNT_ID;
resetLiveFetchImpl();
const noTok = await buildMetaAdsReport({ range: '30d', source: 'live' });
assert('no token not live', noTok.report.meta.freshness !== 'live');
assert('no token config false', metaAdsConfig().token_configured === false);

// Health never leaks token
process.env.META_ADS_ACCESS_TOKEN = 'super-secret-token-value-xyz';
process.env.META_ADS_ACCOUNT_ID = 'act_111';
const health = buildMetaAdsHealth();
const healthJson = JSON.stringify(health);
assert('health live_implemented true', health.live_implemented === true);
assert('health token_configured true', health.token_configured === true);
assert('health no secret string', !healthJson.includes('super-secret-token-value-xyz'));
assert('health has no token field', health.token === undefined && health.access_token === undefined);
assert('health account_id from env only', health.account_id === 'act_111');
// Ensure assumption id is not baked as sole path when env differs
assert('no hard-coded assumption act forced', health.account_id !== 'act_109433652503382' || process.env.META_ADS_ACCOUNT_ID === 'act_109433652503382');

// resolveSource with token → live
assert('auto with creds → live', resolveSource('auto', { nodeEnv: 'production' }) === 'live');

// restore env
if (prevTok !== undefined) process.env.META_ADS_ACCESS_TOKEN = prevTok;
else delete process.env.META_ADS_ACCESS_TOKEN;
if (prevAct !== undefined) process.env.META_ADS_ACCOUNT_ID = prevAct;
else delete process.env.META_ADS_ACCOUNT_ID;
resetLiveFetchImpl();

console.log(`\n═══ result: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
