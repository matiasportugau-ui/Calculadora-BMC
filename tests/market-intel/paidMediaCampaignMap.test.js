// Unit tests — paid media campaign → service line map (current Big 4).
// Run: node tests/market-intel/paidMediaCampaignMap.test.js

import {
  resolveLine,
  enrichCampaignsWithLine,
  enrichReportWithServiceLines,
  buildByLineSummary,
  META_BIG4_NAMES,
} from '../../server/lib/marketIntel/paidMediaCampaignMap.js';
import { mapSnapshotToReport } from '../../server/lib/marketIntel/metaAdsSnapshotMapper.js';
import { buildMetaAdsReport } from '../../server/lib/marketIntel/metaAdsReport.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ads = JSON.parse(
  readFileSync(join(__dirname, '../../server/lib/marketIntel/data/adsIntelligence.json'), 'utf-8'),
);

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

console.log('\n═══ paidMediaCampaignMap ═══');

assert('META_BIG4_NAMES length 4', META_BIG4_NAMES.length === 4);

const p1 = resolveLine('meta', 'Lead Gen Pilar 1 — Rendimiento');
assert('pilar1 line rendimiento', p1.line_id === 'rendimiento', p1);
assert('pilar1 kpi lead', p1.kpi === 'lead');
assert('pilar1 funnel mof', p1.funnel === 'mof');
assert('pilar1 exact', p1.matched_by === 'exact');

const p2 = resolveLine('meta', 'Lead Gen Pilar 2 — Instalación');
assert('pilar2 line instalacion', p2.line_id === 'instalacion', p2);

const traf = resolveLine('meta', 'Tráfico Web');
assert('trafico kpi traffic', traf.kpi === 'traffic' && traf.line_id === 'generic', traf);

const rem = resolveLine('meta', 'Remarketing');
assert('remarketing shared_bof', rem.line_id === 'shared_bof', rem);

const fuzzy = resolveLine('meta', 'Lead Gen Pilar 1 - Rendimiento EXTRA');
assert('fuzzy pilar1 via pattern', fuzzy.line_id === 'rendimiento', fuzzy);

const orphan = resolveLine('meta', 'Random Campaign XYZ');
assert('orphan unmapped', orphan.line_id === 'orphan', orphan);

const gShop = resolveLine('google', 'Sales-Shopping-1');
assert('google shopping → rendimiento', gShop.line_id === 'rendimiento', gShop);

const enriched = enrichCampaignsWithLine([
  { id: '1', name: 'Lead Gen Pilar 1 — Rendimiento', spend: 4500, results: 10 },
  { id: '2', name: 'Tráfico Web', spend: 2000, results: 0 },
]);
assert('enrich line_id set', enriched[0].line_id === 'rendimiento' && enriched[1].kpi === 'traffic');

const byLine = buildByLineSummary(enriched);
assert('by_line has 2 groups', byLine.length === 2, byLine.length);
const trafRow = byLine.find((r) => r.line_id === 'generic');
assert('traffic scoring mode', trafRow?.kpi_scoring === 'traffic', trafRow);

const snap = mapSnapshotToReport(ads, '30d');
const report = enrichReportWithServiceLines(structuredClone(snap), 'meta');
assert('snapshot all 4 mapped non-orphan', report.campaigns.every((c) => c.line_id !== 'orphan'), report.campaigns.map((c) => c.line_id));
assert('snapshot by_line length >= 4', report.by_line.length >= 4, report.by_line.length);

// Full orchestrator snapshot path
const prevTok = process.env.META_ADS_ACCESS_TOKEN;
const prevAct = process.env.META_ADS_ACCOUNT_ID;
delete process.env.META_ADS_ACCESS_TOKEN;
delete process.env.META_ADS_ACCOUNT_ID;

const { report: built } = await buildMetaAdsReport({ range: '30d', source: 'snapshot' });
assert('build snapshot has by_line', Array.isArray(built.by_line) && built.by_line.length >= 1, built.by_line);
assert(
  'build snapshot campaigns have line_id',
  built.campaigns.every((c) => c.line_id),
  built.campaigns.map((c) => c.line_id),
);

// Snapshot by_line must include the four current service lines
const lineIds = new Set((built.by_line || []).map((r) => r.line_id));
for (const id of ['rendimiento', 'instalacion', 'generic', 'shared_bof']) {
  assert(`snapshot by_line has ${id}`, lineIds.has(id), [...lineIds]);
}
const generic = (built.by_line || []).find((r) => r.line_id === 'generic');
assert('generic traffic scoring', generic?.kpi_scoring === 'traffic', generic);

if (prevTok !== undefined) process.env.META_ADS_ACCESS_TOKEN = prevTok;
if (prevAct !== undefined) process.env.META_ADS_ACCOUNT_ID = prevAct;

console.log(`\n═══ ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
