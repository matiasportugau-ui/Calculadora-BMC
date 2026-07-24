// Maps static adsIntelligence.json → partial MetaAdsReport DTO.
// Missing series/placements/efficiency metrics stay null (never fake zeros for CPL).

import { createHash } from 'node:crypto';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, ytd: null, year: 365 };

function dateRange(rangeKey) {
  const stop = new Date();
  const stopStr = stop.toISOString().slice(0, 10);
  let start;
  if (rangeKey === 'ytd') {
    start = `${stop.getUTCFullYear()}-01-01`;
  } else {
    const days = RANGE_DAYS[rangeKey] || 30;
    const s = new Date(stop);
    s.setUTCDate(s.getUTCDate() - (days - 1));
    start = s.toISOString().slice(0, 10);
  }
  return { date_start: start, date_stop: stopStr, range_key: rangeKey in RANGE_DAYS || rangeKey === 'ytd' ? rangeKey : '30d' };
}

function objectiveStatus(nombre, inv) {
  // Snapshot only lists Big 4 as active spenders
  return inv > 0 ? 'ACTIVE' : 'UNKNOWN';
}

/**
 * @param {object|null} ads - getAdsIntelligence() payload
 * @param {string} rangeKey
 * @returns {object} MetaAdsReport partial
 */
export function mapSnapshotToReport(ads, rangeKey = '30d') {
  const range = dateRange(rangeKey);
  const big4 = Array.isArray(ads?.big_4_campanas) ? ads.big_4_campanas : [];
  const spend = ads?.inversion_total_mensual_usd != null ? Number(ads.inversion_total_mensual_usd) : null;

  const campaigns = big4.map((c, i) => {
    const s = c.inversion_mensual_usd != null ? Number(c.inversion_mensual_usd) : null;
    return {
      id: `snap-${i + 1}`,
      name: c.nombre || `Campaña ${i + 1}`,
      objective: c.objetivo || 'unknown',
      status: objectiveStatus(c.nombre, s || 0),
      spend: s,
      results: null,
      cpl: null,
      roas: null,
      ctr: null,
      impressions: null,
      clicks: null,
      share_of_spend: spend && s != null ? Math.round((s / spend) * 1000) / 10 : null,
    };
  });

  // Represent zombies as diagnostic count only (no named rows in snapshot)
  const creatives = (ads?.ad_copy_angles || []).map((a, i) => ({
    id: `angle-${i + 1}`,
    name: a.nombre || `Ángulo ${i + 1}`,
    headline: a.headline || '',
    spend: null,
    results: null,
    cpl: null,
    ctr: null,
    thumbnail_url: null,
  }));

  const stale = Boolean(ads?.fecha_audit);
  const report = {
    meta: {
      provider: 'meta',
      account_id: null,
      currency: 'USD',
      date_start: range.date_start,
      date_stop: range.date_stop,
      range_key: range.range_key,
      freshness: stale ? 'snapshot' : 'snapshot',
      fetched_at: new Date().toISOString(),
      source: 'adsIntelligence.json',
      report_hash: '',
      notes: [
        ads?.fecha_audit ? `fecha_audit=${ads.fecha_audit}` : 'sin fecha_audit',
        ads?.nota || '',
        ads?.fuente || '',
      ].filter(Boolean),
    },
    kpis: {
      spend,
      impressions: null,
      clicks: null,
      reach: null,
      frequency: null,
      results: null,
      result_type: 'lead',
      cpl: null,
      roas: null,
      cost_per_result: null,
      ctr: null,
      cpm: null,
      cpc: null,
      deltas: null,
    },
    series: [],
    campaigns,
    platforms: [],
    placements: [],
    creatives,
    diagnostics: {
      total_campaigns: ads?.total_campanas ?? null,
      active: ads?.campanas_activas ?? null,
      zombie: ads?.campanas_zombie ?? null,
      diagnostico: ads?.diagnostico || null,
      frequency_warning: false,
      notes: [
        ads?.recomendacion_asc || '',
        ads?.presupuesto_recomendado_asc_usd
          ? `ASC presupuesto sugerido: ${ads.presupuesto_recomendado_asc_usd}`
          : '',
      ].filter(Boolean),
    },
    recommendations: [],
  };

  report.meta.report_hash = hashReport(report);
  return report;
}

export function hashReport(report) {
  const clone = structuredClone
    ? structuredClone(report)
    : JSON.parse(JSON.stringify(report));
  if (clone.meta) clone.meta.report_hash = '';
  // Drop volatile timestamps from hash
  if (clone.meta) clone.meta.fetched_at = '';
  return createHash('sha256').update(JSON.stringify(clone)).digest('hex').slice(0, 16);
}
