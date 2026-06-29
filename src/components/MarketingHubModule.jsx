import React, { useEffect, useState, useCallback } from 'react';
import { getCalcApiBase } from '../utils/calcApiBase.js';
import { useBmcAuth } from '../hooks/useBmcAuth.js';
import SummaryCards from './marketing-hub/SummaryCards.jsx';
import TopDeltaTable from './marketing-hub/TopDeltaTable.jsx';
import AlertsFeed from './marketing-hub/AlertsFeed.jsx';
import MysteryShoppingWidget from './marketing-hub/MysteryShoppingWidget.jsx';
import AiStrategicBrief from './marketing-hub/AiStrategicBrief.jsx';
import CategoryIntelligence from './marketing-hub/CategoryIntelligence.jsx';

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, '');
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function MarketingHubModule() {
  const { accessToken } = useBmcAuth();
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [msQueue, setMsQueue] = useState(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [msPage, setMsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [productIntel, setProductIntel] = useState(null);

  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch(accessToken, '/api/marketing/dashboard/summary'),
      apiFetch(accessToken, `/api/marketing/dashboard/alerts?page=${alertsPage}&per_page=25`),
      apiFetch(accessToken, `/api/marketing/mystery-shopping?page=${msPage}&per_page=25`),
      apiFetch(accessToken, '/api/marketing/product-intelligence'),
    ])
      .then(([s, a, ms, pi]) => {
        if (!s.ok) throw new Error(`Summary: ${s.status}`);
        setSummary(s.data);
        setAlerts(a.data);
        setMsQueue(ms.data);
        setProductIntel(pi.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [accessToken, alertsPage, msPage]);

  useEffect(() => { load(); }, [load]);

  const generateBrief = useCallback(async () => {
    if (!accessToken) return;
    setBriefLoading(true);
    setBriefError(null);
    const res = await apiFetch(accessToken, '/api/marketing/ai/brief', { method: 'POST' });
    if (!res.ok) {
      setBriefError(res.data?.error || `Error ${res.status}`);
    } else {
      setBrief(res.data);
    }
    setBriefLoading(false);
  }, [accessToken]);

  const hasEnoughDeltaData = (summary?.top_competitors_by_delta?.length ?? 0) >= 3;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: '#888', fontSize: 14, animation: 'pulse 1s infinite' }}>Cargando Product Intelligence Dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 10, padding: 24, maxWidth: 400 }}>
          <p style={{ fontWeight: 600, color: '#cf1322', marginBottom: 8 }}>Error al cargar el dashboard</p>
          <p style={{ fontSize: 13, color: '#820014', marginBottom: 16 }}>{error}</p>
          <button
            onClick={load}
            style={{ fontSize: 13, padding: '8px 16px', background: '#cf1322', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 16px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a3a5c', margin: 0 }}>Product Intelligence Dashboard</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Inteligencia de precios + análisis estratégico AI — BMC Uruguay</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          {summary?.last_etl_run && (
            <div style={{ color: '#aaa', marginBottom: 8 }}>
              <p style={{ margin: 0 }}>Último ETL: {new Date(summary.last_etl_run.started_at).toLocaleString('es-UY')}</p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: summary.last_etl_run.status === 'success' ? '#389e0d' : summary.last_etl_run.status === 'partial' ? '#d46b08' : '#cf1322' }}>
                  {summary.last_etl_run.status}
                </strong>{' '}
                ({summary.last_etl_run.competitors_succeeded}/{summary.last_etl_run.competitors_attempted})
              </p>
            </div>
          )}
          <button
            onClick={generateBrief}
            disabled={briefLoading}
            style={{
              fontSize: 12, padding: '6px 14px',
              background: briefLoading ? '#d9d9d9' : '#1a3a5c',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: briefLoading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {briefLoading ? 'Generando…' : 'Generar Brief AI'}
          </button>
        </div>
      </div>

      {/* AI Strategic Brief */}
      <AiStrategicBrief
        brief={brief}
        loading={briefLoading}
        error={briefError}
        onRetry={generateBrief}
      />

      {/* Summary cards */}
      {summary && <SummaryCards summary={summary} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
        {/* Top competitors by delta */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>
            Top 10 por variación de precio — 7 días
          </h2>
          {hasEnoughDeltaData ? (
            <TopDeltaTable rows={summary.top_competitors_by_delta} />
          ) : (
            <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: 10, padding: 32, textAlign: 'center', color: '#888' }}>
              <p style={{ fontWeight: 600, margin: 0 }}>Datos insuficientes</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Se necesitan al menos 3 puntos de datos para mostrar tendencias.</p>
            </div>
          )}
        </section>

        {/* Category Intelligence */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>
            Resumen de inteligencia
          </h2>
          <CategoryIntelligence categories={productIntel?.categories} summary={summary} />
        </section>
      </div>

      {/* Alerts feed */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>Feed de alertas</h2>
        {alerts && <AlertsFeed data={alerts} currentPage={alertsPage} onPageChange={setAlertsPage} />}
      </section>

      {/* Mystery shopping */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>
          Cola de mystery shopping
          {(summary?.pending_mystery_shopping_count ?? 0) > 0 && (
            <span style={{ marginLeft: 8, padding: '2px 10px', fontSize: 12, background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591', borderRadius: 20, fontWeight: 600 }}>
              {summary.pending_mystery_shopping_count} pendientes
            </span>
          )}
        </h2>
        {msQueue && <MysteryShoppingWidget data={msQueue} currentPage={msPage} onPageChange={setMsPage} />}
      </section>
    </div>
  );
}
