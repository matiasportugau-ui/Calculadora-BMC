// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import React, { useEffect, useState, useCallback } from 'react';
import { getCalcApiBase } from '../utils/calcApiBase.js';
import { useBmcAuthContext } from '../contexts/bmcAuthContext.js';
import SummaryCards from './marketing-hub/SummaryCards.jsx';
import TopDeltaTable from './marketing-hub/TopDeltaTable.jsx';
import AlertsFeed from './marketing-hub/AlertsFeed.jsx';
import MysteryShoppingWidget from './marketing-hub/MysteryShoppingWidget.jsx';

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, '');
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function MarketingHubModule() {
  // Market Intelligence authenticates with the logged-in operator's identity JWT.
  // The SPA route is gated by <RequireGrant role="admin">, so this is always an
  // admin session; the backend accepts this JWT (or the static service token).
  const { accessToken } = useBmcAuthContext();
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [msQueue, setMsQueue] = useState(null);
  const [alertsPage, setAlertsPage] = useState(1);
  const [msPage, setMsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [s, a, ms] = await Promise.all([
        apiFetch(accessToken, '/api/marketing/dashboard/summary'),
        apiFetch(accessToken, `/api/marketing/dashboard/alerts?page=${alertsPage}&per_page=25`),
        apiFetch(accessToken, `/api/marketing/mystery-shopping?page=${msPage}&per_page=25`),
      ]);

      if (!s.ok) {
        throw new Error(
          s.status === 401 || s.status === 403
            ? `Sesión no autorizada (${s.status}). Volvé a iniciar sesión.`
            : `No se pudo cargar el resumen (HTTP ${s.status}).`
        );
      }

      setSummary(s.data);
      setAlerts(a.data);
      setMsQueue(ms.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, alertsPage, msPage]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: '#888', fontSize: 14, animation: 'pulse 1s infinite' }}>Cargando Market Intelligence…</p>
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

  const hasEnoughDeltaData = (summary?.top_competitors_by_delta?.length ?? 0) >= 3;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a3a5c', margin: 0 }}>Market Intelligence</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Monitoreo de precios de competidores — BMC Uruguay</p>
        </div>
        {summary?.last_etl_run && (
          <div style={{ textAlign: 'right', fontSize: 12, color: '#aaa' }}>
            <p style={{ margin: 0 }}>Último ETL: {new Date(summary.last_etl_run.started_at).toLocaleString('es-UY')}</p>
            <p style={{ margin: 0 }}>
              Estado: <strong style={{ color: summary.last_etl_run.status === 'success' ? '#389e0d' : summary.last_etl_run.status === 'partial' ? '#d46b08' : '#cf1322' }}>
                {summary.last_etl_run.status}
              </strong>{' '}
              ({summary.last_etl_run.competitors_succeeded}/{summary.last_etl_run.competitors_attempted})
            </p>
          </div>
        )}
      </div>

      {/* Not-provisioned notice — module deployed but no data/ETL yet */}
      {summary?.provisioned === false && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#874d00' }}>
          Market Intelligence todavía no tiene datos. El módulo está desplegado pero aún no se ejecutó el primer ETL (o la base no está aprovisionada). Las métricas aparecerán automáticamente cuando haya datos.
        </div>
      )}

      {/* Summary cards */}
      {summary && <SummaryCards summary={summary} />}

      {/* Top competitors by delta */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>
          Top 10 por variación de precio — últimos 7 días
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
