// Meta Ads Live Report — Marketing Hub tab (PR1).
// Fetches GET /api/marketing/ads/meta/report · skinned --ac-* tokens.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getCalcApiBase } from '../../utils/calcApiBase.js';
import {
  money,
  moneyPrecise,
  num,
  pct,
  deltaLabel,
  freshnessLabel,
  freshnessColor,
} from './meta-ads/metaAdsFormat.js';
import MetaAdsInsightsCard from './meta-ads/MetaAdsInsightsCard.jsx';
import MetaAdsAnalystChat from './meta-ads/MetaAdsAnalystChat.jsx';

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const card = {
  background: 'var(--ac-surface)',
  border: '1px solid var(--ac-border)',
  borderRadius: 'var(--ac-radius)',
  padding: 16,
  boxShadow: 'var(--ac-shadow-1)',
};

function Section({ title, meta, children }) {
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>{title}</h3>
        {meta && <span style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function EmptyZone({ reason, cta, onCta }) {
  return (
    <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--ac-text-3)', fontSize: 13, background: 'var(--ac-surface-2)', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border-2)' }}>
      <p style={{ margin: 0 }}>{reason || 'Sin datos en esta fuente'}</p>
      {cta && onCta && (
        <button type="button" onClick={onCta} style={{ marginTop: 10, fontSize: 12, padding: '6px 12px', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)', background: 'var(--ac-surface)', color: 'var(--ac-text)', cursor: 'pointer', fontWeight: 600 }}>
          {cta}
        </button>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', padding: '14px 16px', boxShadow: 'var(--ac-shadow-1)' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-3)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: accent || 'var(--ac-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ac-text-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TrendChart({ series }) {
  if (!series?.length) return null;
  const maxSpend = Math.max(...series.map((s) => s.spend || 0), 1);
  const maxRes = Math.max(...series.map((s) => s.results || 0), 1);
  const w = 640;
  const h = 140;
  const pad = 8;
  const barW = Math.max(2, (w - pad * 2) / series.length - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Tendencia de spend y resultados">
      {series.map((s, i) => {
        const x = pad + i * ((w - pad * 2) / series.length);
        const bh = ((s.spend || 0) / maxSpend) * (h - 28);
        return (
          <rect key={`s-${s.date}`} x={x} y={h - 16 - bh} width={barW} height={bh} fill="var(--ac-accent)" opacity={0.75} rx={1} />
        );
      })}
      <polyline
        fill="none"
        stroke="var(--ac-success)"
        strokeWidth="2"
        points={series
          .map((s, i) => {
            const x = pad + i * ((w - pad * 2) / series.length) + barW / 2;
            const y = h - 16 - ((s.results || 0) / maxRes) * (h - 28);
            return `${x},${y}`;
          })
          .join(' ')}
      />
      <text x={pad} y={12} fontSize="10" fill="var(--ac-text-3)">Spend (barras) · Resultados (línea)</text>
    </svg>
  );
}

function HorizontalBars({ rows, valueKey = 'spend' }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => {
        const label = r.platform || r.placement || r.name;
        const val = r[valueKey] || 0;
        const pctW = Math.round((val / max) * 100);
        return (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: 'var(--ac-text)', fontWeight: 600 }}>{label}</span>
              <span style={{ color: 'var(--ac-text-2)', fontVariantNumeric: 'tabular-nums' }}>{money(val)}</span>
            </div>
            <div style={{ height: 8, background: 'var(--ac-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pctW}%`, height: '100%', background: 'var(--ac-accent)', borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MetaAdsLiveReport({ token }) {
  const [range, setRange] = useState('30d');
  const [source, setSource] = useState('auto');
  const [report, setReport] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);
  const lastInsightsHash = React.useRef(null);

  const loadInsights = useCallback(async (force = false) => {
    if (!token) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await apiFetch(token, '/api/marketing/ai/ads-insights', {
        method: 'POST',
        body: JSON.stringify({ range, source }),
      });
      if (!res.ok) {
        setInsightsError(res.data?.error || `Error ${res.status}`);
      } else {
        setInsights(res.data?.insights || null);
        lastInsightsHash.current = res.data?.report_hash || null;
      }
    } catch {
      setInsightsError('No se pudieron generar insights AI');
    } finally {
      setInsightsLoading(false);
    }
  }, [token, range, source]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const q = `range=${encodeURIComponent(range)}&source=${encodeURIComponent(source)}`;
      const [r, h] = await Promise.all([
        apiFetch(token, `/api/marketing/ads/meta/report?${q}`),
        apiFetch(token, '/api/marketing/ads/meta/health'),
      ]);
      if (!r.ok) {
        setError(r.data?.error || `Error ${r.status}`);
        setReport(null);
      } else {
        setReport(r.data);
        const hash = r.data?.meta?.report_hash;
        if (hash && hash !== lastInsightsHash.current) {
          // auto insights once per report_hash
          loadInsights(false);
        }
      }
      if (h.ok) setHealth(h.data);
    } catch {
      setError('No se pudo cargar el reporte Meta Ads');
    } finally {
      setLoading(false);
    }
  }, [token, range, source, loadInsights]);

  useEffect(() => { load(); }, [load]);

  const kpis = report?.kpis;
  const deltas = kpis?.deltas;
  const freshness = report?.meta?.freshness;
  const series = report?.series || [];
  const platforms = report?.platforms || [];
  const placements = report?.placements || [];
  const creatives = report?.creatives || [];
  const recs = report?.recommendations || [];
  const diag = report?.diagnostics;

  const selectStyle = {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 'var(--ac-radius-sm)',
    border: '1px solid var(--ac-border)',
    background: 'var(--ac-surface)',
    color: 'var(--ac-text)',
    cursor: 'pointer',
  };

  const sortedCampaigns = useMemo(
    () => [...(report?.campaigns || [])].sort((a, b) => (b.spend || 0) - (a.spend || 0)),
    [report?.campaigns],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>
            Meta Ads Live Report
          </h2>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: freshnessColor(freshness),
              background: 'var(--ac-surface-2)',
              border: '1px solid var(--ac-border)',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: 999, background: freshnessColor(freshness) }} />
            {freshnessLabel(freshness)}
          </span>
          {report?.meta?.date_start && (
            <span style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>
              {report.meta.date_start} → {report.meta.date_stop}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Rango" value={range} onChange={(e) => setRange(e.target.value)} style={selectStyle}>
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="90d">90 días</option>
            <option value="ytd">YTD</option>
            <option value="year">Año</option>
          </select>
          <select aria-label="Fuente" value={source} onChange={(e) => setSource(e.target.value)} style={selectStyle}>
            <option value="auto">Auto</option>
            <option value="demo">Demo</option>
            <option value="snapshot">Snapshot</option>
            <option value="live">Live</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              fontSize: 12,
              padding: '7px 14px',
              borderRadius: 'var(--ac-radius-sm)',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              border: 'none',
              background: 'var(--ac-accent)',
              color: 'var(--ac-accent-fg)',
            }}
          >
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {report?.meta?.notes?.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ac-text-2)', lineHeight: 1.45 }}>
          {report.meta.notes.join(' · ')}
          {health && !health.token_configured && (
            <span> · Token Meta Ads no configurado (Live = PR3)</span>
          )}
        </p>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 'var(--ac-radius-sm)', background: 'color-mix(in srgb, var(--ac-error) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ac-error) 30%, transparent)', color: 'var(--ac-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Scorecards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <KpiCard label="Spend" value={money(kpis?.spend)} sub={deltaLabel(deltas?.spend_pct) ? `Δ ${deltaLabel(deltas?.spend_pct)}` : 'vs período ant. —'} />
        <KpiCard label="Resultados (leads)" value={num(kpis?.results)} sub={deltaLabel(deltas?.results_pct) ? `Δ ${deltaLabel(deltas?.results_pct)}` : null} accent="var(--ac-success)" />
        <KpiCard label="CPL" value={moneyPrecise(kpis?.cpl)} sub={deltaLabel(deltas?.cpl_pct) ? `Δ ${deltaLabel(deltas?.cpl_pct)}` : 'primario lead-gen'} accent="var(--ac-accent)" />
        <KpiCard label="CTR" value={pct(kpis?.ctr)} />
        <KpiCard label="CPM" value={moneyPrecise(kpis?.cpm)} />
        <KpiCard
          label="Reach · Freq"
          value={kpis?.reach != null ? num(kpis.reach) : '—'}
          sub={kpis?.frequency != null ? `freq ${num(kpis.frequency, 1)}` : null}
        />
        <KpiCard
          label="Activas / Total"
          value={diag ? `${diag.active ?? '—'}/${diag.total_campaigns ?? '—'}` : '—'}
          sub={diag?.zombie != null ? `${diag.zombie} zombies` : null}
          accent="var(--ac-warn)"
        />
      </div>

      {diag?.diagnostico && (
        <div style={{ padding: '10px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'color-mix(in srgb, var(--ac-warn) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ac-warn) 30%, transparent)', fontSize: 12, color: 'var(--ac-text)' }}>
          <strong>Diagnóstico:</strong> {diag.diagnostico}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 16, alignItems: 'start' }} className="metaAdsLiveLayout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <MetaAdsInsightsCard
            insights={insights}
            loading={insightsLoading}
            error={insightsError}
            onRegenerate={() => loadInsights(true)}
          />

          {/* Trend */}
          <Section title="Tendencia" meta={series.length ? `${series.length} días` : null}>
            {series.length > 0 ? (
              <TrendChart series={series} />
            ) : (
              <EmptyZone
                reason="Serie temporal no disponible en Snapshot — usá Demo o Live (PR3)."
                cta="Activar Demo"
                onCta={() => setSource('demo')}
              />
            )}
          </Section>

          {/* Campaigns */}
          <Section title="Campañas" meta={`${sortedCampaigns.length} filas`}>
            {sortedCampaigns.length === 0 ? (
              <EmptyZone reason="Sin campañas en esta fuente" />
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Campaña', 'Objetivo', 'Status', 'Spend', 'Resultados', 'CPL', 'CTR', 'Share %'].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)', borderBottom: '1px solid var(--ac-border)', background: 'var(--ac-surface-2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--ac-text)', borderBottom: '1px solid var(--ac-border-2)' }}>{c.name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--ac-text-2)', borderBottom: '1px solid var(--ac-border-2)' }}>{c.objective}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--ac-border-2)' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border)', color: c.status === 'ACTIVE' ? 'var(--ac-success)' : c.status === 'ZOMBIE' ? 'var(--ac-warn)' : 'var(--ac-text-3)' }}>{c.status}</span>
                        </td>
                        <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--ac-border-2)' }}>{money(c.spend)}</td>
                        <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--ac-border-2)' }}>{num(c.results)}</td>
                        <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--ac-border-2)' }}>{moneyPrecise(c.cpl)}</td>
                        <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--ac-border-2)' }}>{pct(c.ctr)}</td>
                        <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--ac-border-2)' }}>{c.share_of_spend != null ? `${c.share_of_spend}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Platform + Placement */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <Section title="Plataforma" meta="Facebook vs Instagram">
              {platforms.length > 0 ? (
                <HorizontalBars rows={platforms} />
              ) : (
                <EmptyZone reason="Breakdown de plataforma no disponible en Snapshot" cta="Activar Demo" onCta={() => setSource('demo')} />
              )}
            </Section>
            <Section title="Placement" meta="No cortar solo por CPA de segmento">
              {placements.length > 0 ? (
                <HorizontalBars rows={placements} />
              ) : (
                <EmptyZone reason="Breakdown de placement no disponible en Snapshot" cta="Activar Demo" onCta={() => setSource('demo')} />
              )}
            </Section>
          </div>

          {/* Creatives */}
          <Section title="Top creativos" meta={creatives.length ? `top ${creatives.length}` : null}>
            {creatives.length === 0 ? (
              <EmptyZone reason="Sin creativos en esta fuente" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {creatives.map((cr) => (
                  <div key={cr.id} style={{ padding: '10px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border-2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac-text)' }}>{cr.name}</div>
                    {cr.headline && <div style={{ fontSize: 12, color: 'var(--ac-text-2)', fontStyle: 'italic', margin: '4px 0' }}>“{cr.headline}”</div>}
                    <div style={{ fontSize: 11, color: 'var(--ac-text-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>Spend {money(cr.spend)}</span>
                      <span>Res {num(cr.results)}</span>
                      <span>CPL {moneyPrecise(cr.cpl)}</span>
                      <span>CTR {pct(cr.ctr)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Recommendations */}
          <Section title="Recomendaciones" meta={`${recs.length} items`}>
            {recs.length === 0 ? (
              <EmptyZone reason="Sin recomendaciones" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recs.map((r, idx) => (
                  <div key={r.id || `rec-${idx}`} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border-2)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: r.priority === 'alta' ? 'var(--ac-error)' : r.priority === 'media' ? 'var(--ac-warn)' : 'var(--ac-text-3)', minWidth: 40 }}>{r.priority}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ac-text)' }}>{r.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--ac-text-2)', marginTop: 2 }}>{r.reason}</div>
                      {r.expected_effect && <div style={{ fontSize: 11, color: 'var(--ac-text-3)', marginTop: 2 }}>→ {r.expected_effect}</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ac-text-3)', alignSelf: 'flex-start' }}>{r.source === 'rules' ? 'Regla' : 'AI'}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div style={{ position: 'sticky', top: 12 }}>
          <MetaAdsAnalystChat token={token} range={range} source={source} />
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--ac-text-3)' }}>
        PR2 · Analista AI nativo · Live Graph = PR3 · hash {report?.meta?.report_hash || '—'}
      </p>
      <style>{`
        @media (max-width: 960px) {
          .metaAdsLiveLayout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
