// Meta Ads AI insights — parse/validate grounded on MetaAdsReport DTO.
// Pure validation is separate from LLM I/O so unit tests inject fake LLM text.

import { callAgentOnce } from '../agentCore.js';
import { buildMetaAdsReport } from './metaAdsReport.js';

const insightsCache = new Map(); // report_hash -> { insights, at }
const CACHE_TTL_MS = 30 * 60 * 1000;

export const ADS_INSIGHTS_SYSTEM_PROMPT = `Eres el analista nativo de Meta Ads de BMC Uruguay (paneles aislantes, B2B lead gen en Uruguay).
Respondés SOLO con un JSON válido (sin markdown) con esta forma exacta:
{
  "executive_summary": "string 4-6 oraciones",
  "data_mode_note": "string — modo Demo/Snapshot/Live y frescura",
  "insights": [{ "type": "win|risk|opportunity", "title": "string", "detail": "string", "metric_refs": ["cpl"] }],
  "recommendations": [{ "priority": "alta|media|baja", "action": "string", "reason": "string", "next_test": "string" }],
  "client_bullets": ["string"],
  "confidence": "high|medium|low"
}
Reglas:
1) Solo citá números y nombres de campañas presentes en el REPORTE.
2) Primera línea del executive_summary o data_mode_note debe indicar el modo de datos.
3) Objective-aware: no mates campañas de traffic solo por 0 leads.
4) Español rioplatense, profesional, money-first.
5) Máximo 5 insights y 5 recommendations.
6) No inventes ROAS/CPL si son null.`;

export const ADS_CHAT_SYSTEM_PROMPT = `Eres el Meta Ads Analyst de BMC Uruguay. Respondés en español rioplatense, concreto y accionable (máx ~8 oraciones o lista corta).
SOLO usás el REPORTE META inyectado: spend, CPL, campañas, freshness. No inventes campañas ni métricas.
Si el modo es Demo o Snapshot, decilo. Objective-aware: traffic no se castiga por 0 conversiones.
Si faltan datos, pedí qué haría falta (Live Graph / tracking).`;

/**
 * Extract first JSON object from LLM text.
 * @param {string} text
 * @returns {object|null}
 */
export function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : trimmed;
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objMatch) return null;
  try {
    return JSON.parse(objMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Validate + ground insights against report.campaigns names.
 * @param {object|null} raw
 * @param {object} report - MetaAdsReport
 * @param {{ parseFailed?: boolean }} opts
 */
export function validateInsightsAgainstReport(raw, report, opts = {}) {
  const campaignNames = new Set(
    (report?.campaigns || []).map((c) => String(c.name || '').toLowerCase()).filter(Boolean),
  );
  const rulesRecs = (report?.recommendations || []).filter((r) => r.source === 'rules');

  if (!raw || typeof raw !== 'object' || opts.parseFailed) {
    return {
      executive_summary: 'No se pudo generar narrativa AI confiable; se mantienen recomendaciones por reglas.',
      data_mode_note: formatDataModeNote(report),
      insights: [],
      recommendations: rulesRecs.map((r) => ({
        priority: r.priority,
        action: r.action,
        reason: r.reason,
        next_test: r.expected_effect || '',
      })),
      client_bullets: [],
      confidence: 'low',
      grounded: true,
      parse_failed: true,
      rules_retained: true,
    };
  }

  const insights = (Array.isArray(raw.insights) ? raw.insights : [])
    .filter((i) => i && typeof i.title === 'string')
    .slice(0, 5)
    .map((i) => ({
      type: ['win', 'risk', 'opportunity'].includes(i.type) ? i.type : 'opportunity',
      title: String(i.title).slice(0, 200),
      detail: String(i.detail || '').slice(0, 800),
      metric_refs: Array.isArray(i.metric_refs) ? i.metric_refs.map(String).slice(0, 8) : [],
    }));

  const recommendations = [];
  for (const r of Array.isArray(raw.recommendations) ? raw.recommendations : []) {
    if (!r || typeof r.action !== 'string') continue;
    const action = String(r.action).slice(0, 400);
    // Drop AI recs that name unknown campaigns (heuristic: quoted names or "campaña X")
    const mentioned = extractCampaignMentions(action);
    const unknown = mentioned.filter((n) => !campaignNames.has(n.toLowerCase()));
    if (unknown.length > 0) continue;
    recommendations.push({
      priority: ['alta', 'media', 'baja'].includes(r.priority) ? r.priority : 'media',
      action,
      reason: String(r.reason || '').slice(0, 500),
      next_test: String(r.next_test || '').slice(0, 300),
    });
    if (recommendations.length >= 5) break;
  }

  // Always append rules if AI list empty or to ensure rules survive
  const mergedRecs = [...recommendations];
  for (const r of rulesRecs) {
    if (mergedRecs.length >= 8) break;
    if (mergedRecs.some((x) => x.action === r.action)) continue;
    mergedRecs.push({
      priority: r.priority,
      action: r.action,
      reason: r.reason,
      next_test: r.expected_effect || '',
      source: 'rules',
    });
  }

  let confidence = ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium';
  if (report?.meta?.freshness === 'demo' || report?.meta?.freshness === 'snapshot') {
    if (confidence === 'high') confidence = 'medium';
  }

  return {
    executive_summary: String(raw.executive_summary || '').slice(0, 2000) || 'Sin resumen.',
    data_mode_note: String(raw.data_mode_note || formatDataModeNote(report)).slice(0, 400),
    insights,
    recommendations: mergedRecs,
    client_bullets: (Array.isArray(raw.client_bullets) ? raw.client_bullets : [])
      .map((b) => String(b).slice(0, 300))
      .slice(0, 6),
    confidence,
    grounded: true,
    parse_failed: false,
    rules_retained: true,
  };
}

function extractCampaignMentions(action) {
  const names = [];
  const quoted = action.match(/"([^"]{3,80})"/g) || [];
  for (const q of quoted) names.push(q.slice(1, -1));
  return names;
}

export function formatDataModeNote(report) {
  const f = report?.meta?.freshness || 'unknown';
  const src = report?.meta?.source || '';
  const notes = (report?.meta?.notes || []).slice(0, 2).join('; ');
  return `Modo datos: ${f} (source=${src})${notes ? ` — ${notes}` : ''}`;
}

/** Compact report for prompts */
export function compressReportForPrompt(report) {
  const k = report?.kpis || {};
  const camps = (report?.campaigns || []).slice(0, 10).map((c) => ({
    name: c.name,
    objective: c.objective,
    status: c.status,
    spend: c.spend,
    results: c.results,
    cpl: c.cpl,
    ctr: c.ctr,
  }));
  return {
    meta: {
      freshness: report?.meta?.freshness,
      source: report?.meta?.source,
      range_key: report?.meta?.range_key,
      date_start: report?.meta?.date_start,
      date_stop: report?.meta?.date_stop,
      notes: report?.meta?.notes,
    },
    kpis: {
      spend: k.spend,
      results: k.results,
      result_type: k.result_type,
      cpl: k.cpl,
      ctr: k.ctr,
      cpm: k.cpm,
      frequency: k.frequency,
      deltas: k.deltas,
    },
    diagnostics: report?.diagnostics,
    campaigns: camps,
    recommendations_rules: (report?.recommendations || [])
      .filter((r) => r.source === 'rules')
      .map((r) => ({ priority: r.priority, action: r.action, reason: r.reason })),
  };
}

/**
 * Generate insights for range/source using real report builder + LLM.
 * @param {{ range?: string, source?: string, callAgent?: typeof callAgentOnce }} opts
 */
export async function generateAdsInsights(opts = {}) {
  const range = opts.range || '30d';
  const source = opts.source || 'auto';
  const agent = opts.callAgent || callAgentOnce;

  const { report } = await buildMetaAdsReport({ range, source });
  const hash = report.meta.report_hash;
  const cached = insightsCache.get(hash);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { insights: cached.insights, report_hash: hash, cached: true, meta: report.meta };
  }

  const compressed = compressReportForPrompt(report);
  const userContent = `REPORTE META (JSON):\n${JSON.stringify(compressed, null, 2)}\n\nGenerá el JSON de insights.`;

  let rawText = '';
  try {
    const result = await agent(
      [{ role: 'user', content: userContent }],
      {
        channel: 'chat',
        systemPrompt: ADS_INSIGHTS_SYSTEM_PROMPT,
        override: { maxTokens: 2000, temperature: 0.35 },
      },
    );
    rawText = result?.text || '';
  } catch {
    const insights = validateInsightsAgainstReport(null, report, { parseFailed: true });
    return { insights, report_hash: hash, cached: false, meta: report.meta, llm_error: true };
  }

  const parsed = extractJsonObject(rawText);
  const insights = validateInsightsAgainstReport(parsed, report, { parseFailed: !parsed });
  insightsCache.set(hash, { insights, at: Date.now() });
  return { insights, report_hash: hash, cached: false, meta: report.meta };
}

/** Build system prompt for ads chat with report context */
export function buildAdsChatSystemPrompt(report) {
  const compressed = compressReportForPrompt(report);
  return `${ADS_CHAT_SYSTEM_PROMPT}\n\n## REPORTE META (datos vigentes)\n${JSON.stringify(compressed)}`;
}

export function clearInsightsCache() {
  insightsCache.clear();
}
