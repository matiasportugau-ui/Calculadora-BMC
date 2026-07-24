// Unit tests — Meta Ads PR2 insights validation (real shipped modules).
// Run: node tests/market-intel/metaAdsInsights.test.js

import {
  extractJsonObject,
  validateInsightsAgainstReport,
  generateAdsInsights,
  clearInsightsCache,
  compressReportForPrompt,
  formatDataModeNote,
} from '../../server/lib/marketIntel/metaAdsInsights.js';
import { buildMetaAdsReport } from '../../server/lib/marketIntel/metaAdsReport.js';

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

console.log('\n═══ metaAdsInsights PR2 ═══');

const { report } = await buildMetaAdsReport({ range: '30d', source: 'demo' });
assert('real report from builder', report?.campaigns?.length >= 8, report?.campaigns?.length);
assert('data mode note mentions demo', /demo/i.test(formatDataModeNote(report)));

// extractJsonObject
const wrapped = 'Here you go:\n```json\n{"executive_summary":"ok","confidence":"high"}\n```';
const extracted = extractJsonObject(wrapped);
assert('extract from code fence', extracted?.executive_summary === 'ok');
assert('extract invalid → null', extractJsonObject('not json') === null);

// Valid insights accepted
const knownName = report.campaigns[0].name;
const validRaw = {
  executive_summary: 'Resumen de prueba grounded.',
  data_mode_note: 'Demo',
  insights: [
    { type: 'win', title: 'CPL estable', detail: 'Detalle', metric_refs: ['cpl'] },
  ],
  recommendations: [
    { priority: 'media', action: `Revisar presupuesto de "${knownName}"`, reason: 'Concentración', next_test: 'A/B' },
  ],
  client_bullets: ['Bullet 1'],
  confidence: 'high',
};
const ok = validateInsightsAgainstReport(validRaw, report);
assert('valid insights confidence not forced low', ok.confidence === 'medium' || ok.confidence === 'high', ok.confidence);
// demo freshness caps high→medium
assert('demo caps high to medium', ok.confidence === 'medium', ok.confidence);
assert('valid insights has insight', ok.insights.length === 1);
assert('valid grounded true', ok.grounded === true);
assert('rules retained always', ok.rules_retained === true);
assert('rules present after merge', ok.recommendations.some((r) => r.source === 'rules' || /zombie|Demo|Advantage/i.test(r.action)));

// Unknown campaign names stripped
const badRaw = {
  executive_summary: 'x',
  data_mode_note: 'Demo',
  insights: [],
  recommendations: [
    { priority: 'alta', action: 'Pausar "Campaña Inventada XYZ 999"', reason: 'fake', next_test: '' },
    { priority: 'media', action: `Escalar "${knownName}"`, reason: 'known', next_test: 'test' },
  ],
  client_bullets: [],
  confidence: 'medium',
};
const stripped = validateInsightsAgainstReport(badRaw, report);
const actions = stripped.recommendations.map((r) => r.action);
assert('unknown campaign rec dropped', !actions.some((a) => /Inventada XYZ/.test(a)), actions);
assert('known campaign rec kept', actions.some((a) => a.includes(knownName)), actions);

// Parse failure → low confidence + rules
const failedParse = validateInsightsAgainstReport(null, report, { parseFailed: true });
assert('parse fail confidence low', failedParse.confidence === 'low');
assert('parse fail rules_retained', failedParse.rules_retained === true);
assert('parse fail has rule recs', failedParse.recommendations.length >= 1);
assert('parse fail flag', failedParse.parse_failed === true);

// generateAdsInsights with mocked callAgentOnce (still uses real buildMetaAdsReport)
clearInsightsCache();
const fakeAgent = async () => ({
  text: JSON.stringify({
    executive_summary: 'Mock LLM grounded summary.',
    data_mode_note: 'Demo fixture',
    insights: [{ type: 'risk', title: 'Zombies', detail: 'High zombie share', metric_refs: ['zombie'] }],
    recommendations: [{ priority: 'alta', action: `Pausar zombies near "${knownName}"`, reason: 'hygiene', next_test: 'pause batch' }],
    client_bullets: ['One'],
    confidence: 'high',
  }),
  provider: 'mock',
});
const gen = await generateAdsInsights({ range: '30d', source: 'demo', callAgent: fakeAgent });
assert('generate uses report_hash', typeof gen.report_hash === 'string' && gen.report_hash.length >= 8);
assert('generate insights summary', /Mock LLM/.test(gen.insights.executive_summary));
assert('generate not live freshness', gen.meta.freshness !== 'live', gen.meta.freshness);

// parse fail path via bad LLM text
clearInsightsCache();
const badAgent = async () => ({ text: 'sorry no json here', provider: 'mock' });
const genFail = await generateAdsInsights({ range: '30d', source: 'demo', callAgent: badAgent });
assert('bad llm → low confidence', genFail.insights.confidence === 'low');
assert('bad llm → rules retained', genFail.insights.rules_retained === true);

// compress includes campaigns from real report
const compact = compressReportForPrompt(report);
assert('compress has campaigns', compact.campaigns.length >= 1);
assert('compress no invent spend type', typeof compact.kpis.spend === 'number' || compact.kpis.spend === null);

console.log(`\n═══ result: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
