// Pure UI helpers + structural checks for Market Intel Ads service-line UI.
// Run: node tests/market-intel/serviceLineUiHelpers.test.js

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  campaignCplDisplay,
  kpiBadgeStyle,
  moneyPrecise,
} from '../../src/components/marketing-hub/meta-ads/metaAdsFormat.js';
import {
  buildMetaAdsReport,
} from '../../server/lib/marketIntel/metaAdsReport.js';
import {
  compressReportForPrompt,
  buildAdsChatSystemPrompt,
} from '../../server/lib/marketIntel/metaAdsInsights.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

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

console.log('\n═══ serviceLineUiHelpers ═══');

// Real shipped format helpers (used by campaigns table + ServiceLinesPanel)
assert('traffic campaign CPL is n/a', campaignCplDisplay({ kpi: 'traffic', cpl: 99 }) === 'n/a');
assert(
  'lead campaign CPL uses moneyPrecise',
  campaignCplDisplay({ kpi: 'lead', cpl: 12.5 }) === moneyPrecise(12.5),
  campaignCplDisplay({ kpi: 'lead', cpl: 12.5 }),
);
assert('null lead CPL is dash', campaignCplDisplay({ kpi: 'lead', cpl: null }) === '—');

const trafficStyle = kpiBadgeStyle('traffic');
assert('traffic badge uses muted text token', trafficStyle.color === 'var(--ac-text-3)', trafficStyle);
assert('traffic badge uses --ac-* only values', /var\(--ac-/.test(JSON.stringify(trafficStyle)));
const leadStyle = kpiBadgeStyle('lead');
assert('lead badge uses success token', leadStyle.color === 'var(--ac-success)', leadStyle);

// End-to-end: buildMetaAdsReport snapshot → by_line feeds UI contract
const prevTok = process.env.META_ADS_ACCESS_TOKEN;
const prevAct = process.env.META_ADS_ACCOUNT_ID;
delete process.env.META_ADS_ACCESS_TOKEN;
delete process.env.META_ADS_ACCOUNT_ID;

const { report } = await buildMetaAdsReport({ range: '30d', source: 'snapshot' });
assert('report.by_line length ≥ 4', Array.isArray(report.by_line) && report.by_line.length >= 4, report.by_line?.length);
const ids = new Set(report.by_line.map((r) => r.line_id));
for (const id of ['rendimiento', 'instalacion', 'generic', 'shared_bof']) {
  assert(`UI feed has line ${id}`, ids.has(id), [...ids]);
}
const generic = report.by_line.find((r) => r.line_id === 'generic');
assert('generic kpi_scoring traffic for UI', generic?.kpi_scoring === 'traffic', generic);

// Same report drives AI grounding (shipped compress + chat prompt)
const compact = compressReportForPrompt(report);
assert('AI compact by_line ≥ 4', compact.by_line?.length >= 4, compact.by_line?.length);
assert(
  'AI compact campaigns have line_id',
  compact.campaigns.every((c) => c.line_id),
  compact.campaigns.map((c) => ({ n: c.name, id: c.line_id })),
);
const prompt = buildAdsChatSystemPrompt(report);
assert('chat prompt contains by_line JSON key', prompt.includes('by_line'));
assert('chat prompt includes line_id guidance', /line_id|rendimiento/i.test(prompt));

if (prevTok !== undefined) process.env.META_ADS_ACCESS_TOKEN = prevTok;
if (prevAct !== undefined) process.env.META_ADS_ACCOUNT_ID = prevAct;

// Structural: shipped UI source wires by_line (not a parallel fake map)
const live = readFileSync(join(root, 'src/components/marketing-hub/MetaAdsLiveReport.jsx'), 'utf8');
assert('MetaAdsLiveReport imports ServiceLinesPanel', live.includes("from './meta-ads/ServiceLinesPanel.jsx'"));
assert('MetaAdsLiveReport renders byLine prop', /ServiceLinesPanel\s+byLine=\{report\?\.by_line\}/.test(live));
assert('MetaAdsLiveReport Línea column header', live.includes("'Línea'"));
assert('MetaAdsLiveReport KPI column header', live.includes("'KPI'"));
assert('MetaAdsLiveReport uses campaignCplDisplay', live.includes('campaignCplDisplay'));
assert('MetaAdsLiveReport uses --ac-* tokens', live.includes('var(--ac-'));

const panel = readFileSync(join(root, 'src/components/marketing-hub/meta-ads/ServiceLinesPanel.jsx'), 'utf8');
assert('ServiceLinesPanel title Servicios', panel.includes('Servicios / líneas'));
assert('ServiceLinesPanel uses byLine prop', panel.includes('byLine'));
assert('ServiceLinesPanel traffic n/a CPL', panel.includes("'n/a'") || panel.includes('"n/a"'));
assert('ServiceLinesPanel --ac-* only', panel.includes('var(--ac-') && !/#([0-9a-fA-F]{3,8})\b/.test(panel.replace(/var\(--ac-[^)]+\)/g, '')));

const intel = readFileSync(join(root, 'src/components/marketing-hub/IntelPanel.jsx'), 'utf8');
assert('IntelPanel fetches by-line API', intel.includes('/api/marketing/ads/by-line'));
assert('IntelPanel deep-link handler', intel.includes('onOpenAdsMeta'));
assert('IntelPanel line strip test id', intel.includes('ads-line-strip'));
assert('IntelPanel open ads button test id', intel.includes('open-ads-meta'));

console.log(`\n═══ ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
