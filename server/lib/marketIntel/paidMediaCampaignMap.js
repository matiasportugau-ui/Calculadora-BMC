/**
 * Map **current** Meta/Google campaign names → BMC service lines.
 * Implement-on-existing-campaigns (no rename required).
 *
 * Snapshot source: server/lib/marketIntel/data/adsIntelligence.json (Big 4).
 */

/** Human labels for Hub */
export const SERVICE_LINES = {
  rendimiento: {
    line_id: 'rendimiento',
    label: 'Rendimiento (paneles / core)',
    description: 'Lead Gen Pilar 1 — product performance / panels',
  },
  instalacion: {
    line_id: 'instalacion',
    label: 'Instalación',
    description: 'Lead Gen Pilar 2 — installation services',
  },
  generic: {
    line_id: 'generic',
    label: 'Tráfico web / genérico',
    description: 'Site-wide traffic — not primary CPL',
  },
  shared_bof: {
    line_id: 'shared_bof',
    label: 'Remarketing (BOF compartido)',
    description: 'Cross-line retargeting',
  },
  orphan: {
    line_id: 'orphan',
    label: 'Sin línea (huérfana)',
    description: 'Unmapped campaign name',
  },
};

/**
 * Exact Meta names from current Big 4 (as-is).
 * Add aliases when LIVE renames creatives without losing history.
 */
const META_EXACT = new Map([
  [
    'Lead Gen Pilar 1 — Rendimiento',
    { line_id: 'rendimiento', funnel: 'mof', kpi: 'lead' },
  ],
  [
    'Lead Gen Pilar 2 — Instalación',
    { line_id: 'instalacion', funnel: 'mof', kpi: 'lead' },
  ],
  ['Tráfico Web', { line_id: 'generic', funnel: 'tof', kpi: 'traffic' }],
  ['Trafico Web', { line_id: 'generic', funnel: 'tof', kpi: 'traffic' }],
  ['Remarketing', { line_id: 'shared_bof', funnel: 'bof', kpi: 'lead' }],
]);

/** Substring / regex patterns (order matters — first match wins). */
const PATTERNS = [
  {
    channel: 'meta',
    re: /pilar\s*1|rendimiento/i,
    line_id: 'rendimiento',
    funnel: 'mof',
    kpi: 'lead',
  },
  {
    channel: 'meta',
    re: /pilar\s*2|instalaci[oó]n/i,
    line_id: 'instalacion',
    funnel: 'mof',
    kpi: 'lead',
  },
  {
    channel: 'meta',
    re: /tr[aá]fico|traffic/i,
    line_id: 'generic',
    funnel: 'tof',
    kpi: 'traffic',
  },
  {
    channel: 'meta',
    re: /remarket|retarget|remarketing/i,
    line_id: 'shared_bof',
    funnel: 'bof',
    kpi: 'lead',
  },
  {
    channel: 'google',
    re: /sales-shopping|shopping/i,
    line_id: 'rendimiento',
    funnel: 'mof',
    kpi: 'lead',
  },
  {
    channel: 'google',
    re: /instalaci[oó]n/i,
    line_id: 'instalacion',
    funnel: 'mof',
    kpi: 'lead',
  },
  {
    channel: 'google',
    re: /brand|marca/i,
    line_id: 'generic',
    funnel: 'tof',
    kpi: 'traffic',
  },
];

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * @param {'meta'|'google'|string} channel
 * @param {string} campaignName
 */
export function resolveLine(channel, campaignName) {
  const ch = String(channel || 'meta').toLowerCase() === 'google' ? 'google' : 'meta';
  const name = normalizeName(campaignName);
  if (!name) {
    return {
      line_id: 'orphan',
      funnel: 'unknown',
      kpi: 'unknown',
      label: SERVICE_LINES.orphan.label,
      matched_by: 'empty',
    };
  }

  if (ch === 'meta' && META_EXACT.has(name)) {
    const m = META_EXACT.get(name);
    return {
      ...m,
      label: SERVICE_LINES[m.line_id]?.label || m.line_id,
      matched_by: 'exact',
    };
  }

  if (ch === 'meta') {
    for (const [k, m] of META_EXACT) {
      if (k.toLowerCase() === name.toLowerCase()) {
        return {
          ...m,
          label: SERVICE_LINES[m.line_id]?.label || m.line_id,
          matched_by: 'exact_ci',
        };
      }
    }
  }

  for (const p of PATTERNS) {
    if (p.channel !== ch) continue;
    if (p.re.test(name)) {
      return {
        line_id: p.line_id,
        funnel: p.funnel,
        kpi: p.kpi,
        label: SERVICE_LINES[p.line_id]?.label || p.line_id,
        matched_by: 'pattern',
      };
    }
  }

  return {
    line_id: 'orphan',
    funnel: 'unknown',
    kpi: 'unknown',
    label: SERVICE_LINES.orphan.label,
    matched_by: 'none',
  };
}

/**
 * @param {object[]} campaigns
 * @param {'meta'|'google'} channel
 */
export function enrichCampaignsWithLine(campaigns, channel = 'meta') {
  if (!Array.isArray(campaigns)) return [];
  return campaigns.map((c) => {
    const name = c?.name || c?.nombre || c?.campaign_name || '';
    const res = resolveLine(channel, name);
    return {
      ...c,
      line_id: res.line_id,
      funnel: res.funnel,
      kpi: res.kpi,
      line_label: res.label,
      line_matched_by: res.matched_by,
    };
  });
}

/**
 * @param {object} report
 * @param {'meta'|'google'} channel
 */
export function enrichReportWithServiceLines(report, channel = 'meta') {
  if (!report || typeof report !== 'object') return report;
  const campaigns = enrichCampaignsWithLine(report.campaigns || [], channel);
  report.campaigns = campaigns;
  report.by_line = buildByLineSummary(campaigns);
  if (report.meta) {
    report.meta.service_lines_version = 1;
    const note = 'Campaigns tagged with line_id via paidMediaCampaignMap (current Big 4 aliases)';
    if (!(report.meta.notes || []).includes(note)) {
      report.meta.notes = [...(report.meta.notes || []), note];
    }
  }
  return report;
}

/**
 * @param {object[]} campaigns
 */
export function buildByLineSummary(campaigns = []) {
  const map = {};
  for (const c of campaigns) {
    const id = c.line_id || 'orphan';
    if (!map[id]) {
      map[id] = {
        line_id: id,
        label: c.line_label || SERVICE_LINES[id]?.label || id,
        funnel_modes: new Set(),
        kpi_modes: new Set(),
        campaign_count: 0,
        spend: 0,
        results: 0,
        clicks: 0,
        impressions: 0,
        campaigns: [],
      };
    }
    const row = map[id];
    row.campaign_count += 1;
    if (c.funnel) row.funnel_modes.add(c.funnel);
    if (c.kpi) row.kpi_modes.add(c.kpi);
    if (c.spend != null && Number.isFinite(Number(c.spend))) row.spend += Number(c.spend);
    if (c.results != null && Number.isFinite(Number(c.results))) row.results += Number(c.results);
    if (c.clicks != null && Number.isFinite(Number(c.clicks))) row.clicks += Number(c.clicks);
    if (c.impressions != null && Number.isFinite(Number(c.impressions))) {
      row.impressions += Number(c.impressions);
    }
    row.campaigns.push({
      id: c.id,
      name: c.name,
      status: c.status,
      spend: c.spend,
      results: c.results,
      cpl: c.cpl,
      kpi: c.kpi,
      funnel: c.funnel,
    });
  }

  return Object.values(map)
    .map((r) => {
      const kpiModes = [...r.kpi_modes];
      const leadLike = kpiModes.length === 1 && kpiModes[0] === 'lead';
      const trafficOnly = kpiModes.length === 1 && kpiModes[0] === 'traffic';
      let cpl = null;
      if (leadLike && r.results > 0 && r.spend > 0) {
        cpl = Math.round((r.spend / r.results) * 100) / 100;
      }
      return {
        line_id: r.line_id,
        label: r.label,
        funnel_modes: [...r.funnel_modes],
        kpi_modes: kpiModes,
        kpi_scoring: trafficOnly ? 'traffic' : leadLike ? 'lead' : 'mixed',
        campaign_count: r.campaign_count,
        spend: r.spend || null,
        results: r.results || null,
        clicks: r.clicks || null,
        impressions: r.impressions || null,
        cpl,
        campaigns: r.campaigns,
      };
    })
    .sort((a, b) => (b.spend || 0) - (a.spend || 0));
}

export const META_BIG4_NAMES = [
  'Lead Gen Pilar 1 — Rendimiento',
  'Lead Gen Pilar 2 — Instalación',
  'Tráfico Web',
  'Remarketing',
];
