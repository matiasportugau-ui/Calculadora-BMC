// Servicios / líneas panel — presents report.by_line from server map (no client remapping).
// Used on Ads · Meta after scorecards.

import React, { useState } from 'react';
import { money, moneyPrecise, num } from './metaAdsFormat.js';

const card = {
  background: 'var(--ac-surface)',
  border: '1px solid var(--ac-border)',
  borderRadius: 'var(--ac-radius)',
  padding: 16,
  boxShadow: 'var(--ac-shadow-1)',
};

const th = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--ac-text-2)',
  borderBottom: '1px solid var(--ac-border)',
  background: 'var(--ac-surface-2)',
  whiteSpace: 'nowrap',
};

const td = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--ac-border-2)',
  fontSize: 12,
  color: 'var(--ac-text)',
};

/** KPI badge styles — traffic is muted so it is not read as failed lead CPL */
export function kpiBadgeStyle(kpi) {
  const base = {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 999,
    border: '1px solid var(--ac-border)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  };
  if (kpi === 'traffic') {
    return {
      ...base,
      background: 'var(--ac-surface-2)',
      color: 'var(--ac-text-3)',
      borderColor: 'var(--ac-border-2)',
    };
  }
  if (kpi === 'lead') {
    return {
      ...base,
      background: 'color-mix(in srgb, var(--ac-success) 14%, transparent)',
      color: 'var(--ac-success)',
    };
  }
  return {
    ...base,
    background: 'var(--ac-surface-2)',
    color: 'var(--ac-text-2)',
  };
}

export function formatKpiLabel(kpiScoring, kpi) {
  const mode = kpiScoring || kpi || 'unknown';
  if (mode === 'traffic') return 'traffic';
  if (mode === 'lead') return 'lead';
  if (mode === 'mixed') return 'mixed';
  return String(mode);
}

/**
 * Display CPL for a line: n/a for pure traffic scoring.
 * @param {{ kpi_scoring?: string, kpi?: string, cpl?: number|null }} row
 */
export function formatLineCpl(row) {
  const scoring = row?.kpi_scoring || row?.kpi;
  if (scoring === 'traffic') return 'n/a';
  if (row?.cpl == null || Number.isNaN(Number(row.cpl))) return '—';
  return moneyPrecise(row.cpl);
}

/**
 * @param {{ byLine?: object[] }} props
 */
export default function ServiceLinesPanel({ byLine }) {
  const [openId, setOpenId] = useState(null);
  const rows = Array.isArray(byLine) ? byLine : [];

  if (rows.length === 0) {
    return (
      <section style={card} data-testid="service-lines-panel">
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>
          Servicios / líneas
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ac-text-3)' }}>
          Sin rollup por línea en este reporte (esperá Snapshot Big 4 o Live con campañas mapeadas).
        </p>
      </section>
    );
  }

  return (
    <section style={card} data-testid="service-lines-panel">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>
          Servicios / líneas
        </h3>
        <span style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>
          {rows.length} líneas · campañas actuales (sin renombrar)
        </span>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Línea', 'Campañas', 'Spend', 'Resultados', 'CPL', 'KPI'].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = row.line_id || row.label;
              const expanded = openId === id;
              const kpiMode = formatKpiLabel(row.kpi_scoring, row.kpi);
              return (
                <React.Fragment key={id}>
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => setOpenId(expanded ? null : id)}
                    data-line-id={row.line_id}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>
                      <span style={{ color: 'var(--ac-text-3)', marginRight: 6 }}>{expanded ? '▾' : '▸'}</span>
                      {row.label || row.line_id}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{num(row.campaign_count)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{money(row.spend)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{num(row.results)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums', color: kpiMode === 'traffic' ? 'var(--ac-text-3)' : 'var(--ac-text)' }}>
                      {formatLineCpl(row)}
                    </td>
                    <td style={td}>
                      <span style={kpiBadgeStyle(kpiMode)}>{kpiMode}</span>
                    </td>
                  </tr>
                  {expanded && Array.isArray(row.campaigns) && row.campaigns.length > 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...td, background: 'var(--ac-surface-2)', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {row.campaigns.map((c) => (
                            <div
                              key={c.id || c.name}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                                fontSize: 12,
                                color: 'var(--ac-text-2)',
                              }}
                            >
                              <span style={{ fontWeight: 600, color: 'var(--ac-text)' }}>{c.name}</span>
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {money(c.spend)}
                                {c.kpi === 'traffic' ? ' · traffic' : c.results != null ? ` · res ${num(c.results)}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--ac-text-3)' }}>
        KPI traffic: no se juzga como lead-gen fallido (CPL = n/a). Mapa servidor: paidMediaCampaignMap.
      </p>
    </section>
  );
}
