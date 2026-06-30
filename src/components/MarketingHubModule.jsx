// Module: market-intelligence | Owner: bmc-dev
// Market Intelligence hub tab. Skinned (.adminCot data-skin) + tabbed shell:
//   Resumen      → KPI strip · Product Matrix · Active Strategies · Market Intel AI chat
//   Inteligencia → captured investigation (competitor tiers · Meta Ads · ML pulse)
//   Detalle      → salvaged operational widgets (AI brief, deltas, alerts, mystery shopping)
// Backend untouched at the route layer; data via /api/marketing/*.

import React, { useEffect, useState, useCallback } from 'react';
import { getCalcApiBase } from '../utils/calcApiBase.js';
import { useBmcAuth } from '../hooks/useBmcAuth.js';
import { SkinProvider, useSkin, SKINS } from './admin-cotizaciones/SkinProvider.jsx';
import './admin-cotizaciones/styles.css';

import SummaryCards from './marketing-hub/SummaryCards.jsx';
import TopDeltaTable from './marketing-hub/TopDeltaTable.jsx';
import AlertsFeed from './marketing-hub/AlertsFeed.jsx';
import MysteryShoppingWidget from './marketing-hub/MysteryShoppingWidget.jsx';
import AiStrategicBrief from './marketing-hub/AiStrategicBrief.jsx';
import CategoryIntelligence from './marketing-hub/CategoryIntelligence.jsx';
import ProductMatrix from './marketing-hub/ProductMatrix.jsx';
import StrategyCards from './marketing-hub/StrategyCards.jsx';
import IntelPanel from './marketing-hub/IntelPanel.jsx';
import MarketIntelChat from './marketing-hub/MarketIntelChat.jsx';

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, '');
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const settled = (r) => (r.status === 'fulfilled' && r.value.ok ? r.value.data : null);

// ── KPI strip ──────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', padding: '16px 18px', boxShadow: 'var(--ac-shadow-1)' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-3)' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, color: accent || 'var(--ac-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ac-text-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function KpiStrip({ summary, intel }) {
  const comp = intel?.competitors;
  const ads = intel?.ads;
  const ml = intel?.ml;
  const ac = summary?.alert_counts;
  const totalAlerts = ac ? (ac.info || 0) + (ac.warning || 0) + (ac.critical || 0) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      <Kpi label="Competidores" value={comp?.total_competidores ?? '—'} sub={comp?.tiers?.['1'] ? `${comp.tiers['1'].count} críticos (T1)` : null} />
      <Kpi label="Alertas 24h" value={totalAlerts ?? '—'} sub={ac ? `${ac.critical || 0} críticas` : 'sin datos en vivo'} accent={ac?.critical ? 'var(--ac-error)' : undefined} />
      <Kpi label="Campañas activas" value={ads ? `${ads.campanas_activas}/${ads.total_campanas}` : '—'} sub={ads ? `${ads.campanas_zombie} zombies` : null} accent="var(--ac-warn)" />
      <Kpi label="ML Q&A pendientes" value={ml?.metricas?.preguntas_sin_respuesta ?? '—'} sub={ml?.metricas?.tasa_respuesta ? `tasa ${ml.metricas.tasa_respuesta}` : null} />
    </div>
  );
}

// ── Inner module (consumes skin context) ────────────────────────────────────
function MarketingHubInner() {
  const { skin, setSkin } = useSkin();
  const { accessToken } = useBmcAuth();

  const [tab, setTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [msQueue, setMsQueue] = useState(null);
  const [productIntel, setProductIntel] = useState(null);
  const [intel, setIntel] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [msPage, setMsPage] = useState(1);

  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.allSettled([
      apiFetch(accessToken, '/api/marketing/dashboard/summary'),
      apiFetch(accessToken, `/api/marketing/dashboard/alerts?page=${alertsPage}&per_page=25`),
      apiFetch(accessToken, `/api/marketing/mystery-shopping?page=${msPage}&per_page=25`),
      apiFetch(accessToken, '/api/marketing/product-intelligence'),
      apiFetch(accessToken, '/api/marketing/intel'),
      apiFetch(accessToken, '/api/marketing/product-matrix'),
    ]).then(([s, a, ms, pi, it, pm]) => {
      setSummary(settled(s));
      setAlerts(settled(a));
      setMsQueue(settled(ms));
      setProductIntel(settled(pi));
      setIntel(settled(it));
      setMatrix(settled(pm)?.data ?? null);
    }).finally(() => setLoading(false));
  }, [accessToken, alertsPage, msPage]);

  useEffect(() => { load(); }, [load]);

  const generateBrief = useCallback(async () => {
    if (!accessToken) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await apiFetch(accessToken, '/api/marketing/ai/brief', { method: 'POST' });
      if (!res.ok) {
        setBriefError(res.data?.error || `Error ${res.status}`);
      } else {
        // Endpoint returns { brief: {...}, provider, generated_at, ... }; flatten the
        // inner brief so AiStrategicBrief + StrategyCards read fields directly.
        const inner = res.data?.brief;
        setBrief(inner ? { ...inner, provider: res.data.provider, generated_at: res.data.generated_at } : res.data);
      }
    } catch (err) {
      setBriefError(err?.message || 'Error de red');
    } finally {
      setBriefLoading(false);
    }
  }, [accessToken]);

  const syncNow = useCallback(async () => {
    if (!accessToken || syncing) return;
    setSyncing(true);
    let success = false;
    try {
      await apiFetch(accessToken, '/api/marketing/etl/run', { method: 'POST' });
      success = true;
    } catch {
      // fall through
    } finally {
      if (success) {
        setTimeout(() => { load(); setSyncing(false); }, 2500);
      } else {
        setSyncing(false);
      }
    }
  }, [accessToken, syncing, load]);

  const hasEnoughDeltaData = (summary?.top_competitors_by_delta?.length ?? 0) >= 3;

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'inteligencia', label: 'Inteligencia' },
    { id: 'detalle', label: 'Detalle' },
  ];

  const btn = (primary) => ({
    fontSize: 12, padding: '7px 14px', borderRadius: 'var(--ac-radius-sm)', fontWeight: 600, cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--ac-border)',
    background: primary ? 'var(--ac-accent)' : 'var(--ac-surface)',
    color: primary ? 'var(--ac-accent-fg)' : 'var(--ac-text)',
  });

  return (
    <div className="adminCot" data-skin={skin}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 48px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>Market Intelligence</h1>
              {summary?.last_etl_run && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'var(--ac-success)', background: 'color-mix(in srgb, var(--ac-success) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--ac-success) 30%, transparent)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ac-success)' }} />LIVE
                </span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ac-text-2)' }}>Inteligencia de precios y competencia — BMC Uruguay</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {summary?.last_etl_run && (
              <span style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>
                ETL: <strong style={{ color: summary.last_etl_run.status === 'success' ? 'var(--ac-success)' : summary.last_etl_run.status === 'partial' ? 'var(--ac-warn)' : 'var(--ac-error)' }}>{summary.last_etl_run.status}</strong>
              </span>
            )}
            <select aria-label="Tema visual" value={skin} onChange={(e) => setSkin(e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)', background: 'var(--ac-surface)', color: 'var(--ac-text)', cursor: 'pointer' }}>
              {SKINS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button onClick={syncNow} disabled={syncing} style={btn(false)}>{syncing ? 'Sincronizando…' : 'Sync Now'}</button>
            <button onClick={generateBrief} disabled={briefLoading} style={btn(true)}>{briefLoading ? 'Generando…' : 'Generar Brief AI'}</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--ac-border)', marginBottom: 24 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14,
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--ac-text)' : 'var(--ac-text-2)',
                borderBottom: tab === t.id ? '2px solid var(--ac-accent)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Resumen ── */}
        {tab === 'resumen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <KpiStrip summary={summary} intel={intel} />

            <section>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ac-text)', margin: '0 0 12px', fontFamily: 'var(--ac-font-display)' }}>Matriz de productos</h2>
              <ProductMatrix rows={matrix} loading={loading && !matrix} />
            </section>

            <section>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ac-text)', margin: '0 0 12px', fontFamily: 'var(--ac-font-display)' }}>Estrategias activas</h2>
              <StrategyCards brief={brief} />
            </section>

            <section>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ac-text)', margin: '0 0 12px', fontFamily: 'var(--ac-font-display)' }}>Market Intel AI</h2>
              <MarketIntelChat token={accessToken} />
            </section>
          </div>
        )}

        {/* ── Inteligencia ── */}
        {tab === 'inteligencia' && (
          loading && !intel
            ? <p style={{ color: 'var(--ac-text-3)', fontSize: 13 }}>Cargando inteligencia de mercado…</p>
            : <IntelPanel intel={intel} />
        )}

        {/* ── Detalle (salvaged widgets) ── */}
        {tab === 'detalle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <AiStrategicBrief brief={brief} loading={briefLoading} error={briefError} onRetry={generateBrief} />

            {summary && <SummaryCards summary={summary} />}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ac-text)', marginBottom: 12 }}>Top 10 por variación de precio — 7 días</h2>
                {hasEnoughDeltaData ? (
                  <TopDeltaTable rows={summary.top_competitors_by_delta} />
                ) : (
                  <div style={{ background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', padding: 32, textAlign: 'center', color: 'var(--ac-text-3)' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>Datos insuficientes</p>
                    <p style={{ fontSize: 13, marginTop: 6 }}>Se necesitan al menos 3 puntos de datos para mostrar tendencias.</p>
                  </div>
                )}
              </section>
              <section>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ac-text)', marginBottom: 12 }}>Resumen de inteligencia</h2>
                <CategoryIntelligence categories={productIntel?.categories} summary={summary} />
              </section>
            </div>

            <section>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ac-text)', marginBottom: 12 }}>Feed de alertas</h2>
              {alerts && <AlertsFeed data={alerts} currentPage={alertsPage} onPageChange={setAlertsPage} />}
            </section>

            <section>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ac-text)', marginBottom: 12 }}>
                Cola de mystery shopping
                {(summary?.pending_mystery_shopping_count ?? 0) > 0 && (
                  <span style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12, background: 'color-mix(in srgb, var(--ac-warn) 16%, transparent)', color: 'var(--ac-warn)', borderRadius: 20, fontWeight: 600 }}>
                    {summary.pending_mystery_shopping_count} pendientes
                  </span>
                )}
              </h2>
              {msQueue && <MysteryShoppingWidget data={msQueue} currentPage={msPage} onPageChange={setMsPage} />}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketingHubModule() {
  return (
    <SkinProvider>
      <MarketingHubInner />
    </SkinProvider>
  );
}
