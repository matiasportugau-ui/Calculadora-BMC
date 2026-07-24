// Unit tests — Meta Ads report PR1 (mapper, rules, hash, fixture).
// Run: node tests/market-intel/metaAdsReport.test.js

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapSnapshotToReport, hashReport } from '../../server/lib/marketIntel/metaAdsSnapshotMapper.js';
import { buildRulesRecommendations } from '../../server/lib/marketIntel/metaAdsRules.js';
import { loadMetaAdsFixture, clearMetaAdsFixtureCache } from '../../server/lib/marketIntel/metaAdsFixture.js';
import {
  buildMetaAdsReport,
  resolveSource,
  normalizeRange,
} from '../../server/lib/marketIntel/metaAdsReport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const adsPath = join(__dirname, '../../server/lib/marketIntel/data/adsIntelligence.json');
const ads = JSON.parse(readFileSync(adsPath, 'utf-8'));

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

console.log('\n═══ metaAdsReport PR1 ═══');

// Snapshot mapper
const snap = mapSnapshotToReport(ads, '30d');
assert('snapshot freshness', snap.meta.freshness === 'snapshot');
assert('snapshot source', snap.meta.source === 'adsIntelligence.json');
assert('snapshot spend from audit', snap.kpis.spend === 11000);
assert('snapshot series empty', Array.isArray(snap.series) && snap.series.length === 0);
assert('snapshot CPL null (not fake 0)', snap.kpis.cpl === null);
assert('snapshot campaigns from Big 4', snap.campaigns.length === 4);
assert('snapshot zombies in diagnostics', snap.diagnostics.zombie === 68);
assert('snapshot has report_hash', typeof snap.meta.report_hash === 'string' && snap.meta.report_hash.length >= 8);

const h1 = hashReport(snap);
snap.meta.fetched_at = new Date().toISOString();
const h2 = hashReport(snap);
assert('report_hash stable ignoring fetched_at', h1 === h2, { h1, h2 });

// Rules on snapshot (high zombies)
const rules = buildRulesRecommendations(snap);
assert('rules zombie alta present', rules.some((r) => r.id === 'rules-zombie-ratio' && r.priority === 'alta'));
assert('rules snapshot stale present', rules.some((r) => r.id === 'rules-stale-snapshot'));
assert('rules all source=rules', rules.every((r) => r.source === 'rules'));

// Fixture
clearMetaAdsFixtureCache();
const fix = loadMetaAdsFixture();
assert('fixture freshness demo', fix.meta.freshness === 'demo');
assert('fixture series >= 28', fix.series.length >= 28, fix.series.length);
assert('fixture campaigns >= 8', fix.campaigns.length >= 8, fix.campaigns.length);
assert('fixture platforms 2', fix.platforms.length >= 2);
assert('fixture placements >= 4', fix.placements.length >= 4);
assert('fixture creatives >= 5', fix.creatives.length >= 5);
assert('fixture kpis spend non-null', fix.kpis.spend != null && fix.kpis.spend > 0);
assert('fixture cpl non-null', fix.kpis.cpl != null);

// Orchestrator demo/snapshot (async builder)
const prevTok = process.env.META_ADS_ACCESS_TOKEN;
const prevAct = process.env.META_ADS_ACCOUNT_ID;
delete process.env.META_ADS_ACCESS_TOKEN;
delete process.env.META_ADS_ACCOUNT_ID;

const { report: demoReport, resolved_source } = await buildMetaAdsReport({ range: '30d', source: 'demo' });
assert('build demo resolved', resolved_source === 'demo');
assert('build demo recommendations', demoReport.recommendations.length >= 1);
assert('build demo rules demo disclaimer', demoReport.recommendations.some((r) => r.id === 'rules-demo-disclaimer'));

// Auto resolve (no token)
assert('auto prod → snapshot without token', resolveSource('auto', { nodeEnv: 'production' }) === 'snapshot');
assert('auto dev → demo without token', resolveSource('auto', { nodeEnv: 'development' }) === 'demo');
assert('normalize range rejects bad', normalizeRange('nope') === null);
assert('normalize range 30d', normalizeRange('30d') === '30d');

// Snapshot via builder
const { report: snapR, resolved_source: rs } = await buildMetaAdsReport({ range: '30d', source: 'snapshot' });
assert('build snapshot resolved', rs === 'snapshot');
assert('build snapshot empty series', snapR.series.length === 0);
assert('snapshot never live freshness', snapR.meta.freshness !== 'live');

if (prevTok !== undefined) process.env.META_ADS_ACCESS_TOKEN = prevTok;
if (prevAct !== undefined) process.env.META_ADS_ACCOUNT_ID = prevAct;

console.log(`\n═══ result: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
