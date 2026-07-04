import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, Plus, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from 'lucide-react';
import { getCalcApiBase } from '../../utils/calcApiBase.js';

async function apiFetch(path, { headers = {}, ...options } = {}) {
  const base = getCalcApiBase().replace(/\/+$/, '');
  return fetch(`${base}${path}`, { ...options, headers });
}

const PRIORITY_STYLES = {
  P1: 'bg-red-100 text-red-800 border-red-200',
  P2: 'bg-amber-100 text-amber-800 border-amber-200',
  P3: 'bg-slate-100 text-slate-600 border-slate-200',
};

const INTENT_LABELS = {
  transactional: 'Transaccional',
  commercial: 'Comercial',
  informational: 'Informativo',
  navigational: 'Navegacional',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-UY', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function PositionBadge({ position, previous, error, stale }) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700" title={error}>
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">sin datos</span>
      </span>
    );
  }
  if (position == null) {
    return (
      <span className="text-xs text-slate-400" title="BMC no aparece en top 10">
        &gt;10
      </span>
    );
  }
  const delta =
    previous != null && position != null ? previous - position : null;
  const TrendIcon =
    delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor =
    delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex min-w-[2rem] justify-center rounded-md px-2 py-0.5 text-sm font-bold ${
          position <= 3
            ? 'bg-emerald-100 text-emerald-800'
            : position <= 10
              ? 'bg-sky-100 text-sky-800'
              : 'bg-slate-100 text-slate-600'
        }`}
      >
        #{position}
      </span>
      {delta != null && delta !== 0 && (
        <span className={`flex items-center gap-0.5 text-xs ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          {Math.abs(delta)}
        </span>
      )}
      {stale && (
        <Clock className="w-3 h-3 text-amber-500" title="Posición de corrida anterior (SERP falló)" />
      )}
    </div>
  );
}

export default function KeywordMonitor({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [newKeyword, setNewKeyword] = useState('');
  const [adding, setAdding] = useState(false);
  const pollRef = useRef(null);
  const refreshStartedAt = useRef(null);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/marketing/keywords', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      return json;
    } catch (e) {
      setError(e.message || 'Error al cargar keywords');
      return null;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setRefreshing(false);
    refreshStartedAt.current = null;
  }, []);

  const startPolling = useCallback(
    (baselineRefreshAt) => {
      if (pollRef.current) clearInterval(pollRef.current);
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        const json = await load();
        const status = json?.last_refresh_status;
        const changed =
          json?.last_refresh_at &&
          json.last_refresh_at !== baselineRefreshAt &&
          status !== 'running';
        if (changed || attempts >= 36) {
          stopPolling();
        }
      }, 5000);
    },
    [load, stopPolling],
  );

  const handleRefresh = async (priority = null) => {
    setRefreshing(true);
    setError(null);
    const baseline = data?.last_refresh_at;
    refreshStartedAt.current = Date.now();
    try {
      const res = await apiFetch('/api/marketing/keywords/refresh', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (res.status === 202) {
        startPolling(baseline);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      setRefreshing(false);
    } catch (e) {
      setError(e.message || 'Error al refrescar');
      setRefreshing(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const term = newKeyword.trim();
    if (!term) return;
    setAdding(true);
    try {
      const res = await apiFetch('/api/marketing/keywords', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, priority: 'P2', intent: 'commercial' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewKeyword('');
      await load();
    } catch (err) {
      setError(err.message || 'Error al agregar');
    } finally {
      setAdding(false);
    }
  };

  const keywords = useMemo(() => {
    const list = data?.keywords || [];
    if (filterPriority === 'all') return list;
    return list.filter((k) => k.priority === filterPriority);
  }, [data, filterPriority]);

  const stats = useMemo(() => {
    const list = data?.keywords || [];
    const withPos = list.filter((k) => k.serp?.position != null);
    const top3 = withPos.filter((k) => k.serp.position <= 3).length;
    const top10 = withPos.length;
    const errors = list.filter((k) => k.serp?.error).length;
    const stale = list.filter((k) => k.serp?.stale).length;
    return { total: list.length, top3, top10, errors, stale };
  }, [data]);

  const refreshStatus = data?.last_refresh_status;
  const isRunning = refreshStatus === 'running' || refreshing;

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              Monitor de Keywords
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Posición orgánica de{' '}
              <span className="font-medium text-slate-700">{data?.bmc_domain || 'bmcuruguay.com.uy'}</span>
              {' · '}
              motor {data?.serp_engine || 'playwright'}
              {data?.last_refresh_at && (
                <> · última corrida {formatDate(data.last_refresh_at)}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleRefresh('P1')}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              Refrescar P1
            </button>
            <button
              type="button"
              onClick={() => handleRefresh(null)}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Refrescar todo
            </button>
          </div>
        </div>

        {isRunning && (
          <p className="mt-2 text-xs text-indigo-600 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Corrida SERP en segundo plano (~3s entre keywords). La tabla se actualiza sola.
          </p>
        )}
        {refreshStatus === 'partial' && !isRunning && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Última corrida parcial: algunas keywords no obtuvieron SERP (se conservó posición anterior).
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            {stats.total} keywords
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
            {stats.top3} en top 3
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">
            {stats.top10} con posición
          </span>
          {stats.errors > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
              {stats.errors} sin SERP
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:mx-5">
          {error}
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 sm:px-5">
        <span className="text-xs text-slate-500">Prioridad:</span>
        {['all', 'P1', 'P2', 'P3'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilterPriority(p)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              filterPriority === p
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p === 'all' ? 'Todas' : p}
          </button>
        ))}
        <form onSubmit={handleAdd} className="ml-auto flex gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Agregar keyword…"
            className="flex-1 sm:w-48 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            type="submit"
            disabled={adding || !newKeyword.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5 font-medium sm:px-5">Keyword</th>
              <th className="px-2 py-2.5 font-medium w-16">Prio</th>
              <th className="px-2 py-2.5 font-medium w-24 hidden md:table-cell">Intent</th>
              <th className="px-2 py-2.5 font-medium w-28">Posición</th>
              <th className="px-2 py-2.5 font-medium hidden lg:table-cell">Competidores top</th>
              <th className="px-4 py-2.5 font-medium w-28 hidden sm:table-cell sm:px-5">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {keywords.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                  Sin keywords para este filtro.
                </td>
              </tr>
            ) : (
              keywords.map((kw) => (
                <tr key={kw.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 sm:px-5">
                    <span className="font-medium text-slate-900">{kw.term}</span>
                    {kw.cluster && (
                      <span className="block text-[10px] text-slate-400 truncate max-w-[200px]">
                        {kw.cluster}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                        PRIORITY_STYLES[kw.priority] || PRIORITY_STYLES.P3
                      }`}
                    >
                      {kw.priority}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-slate-600 hidden md:table-cell">
                    {INTENT_LABELS[kw.intent] || kw.intent}
                  </td>
                  <td className="px-2 py-2.5">
                    <PositionBadge
                      position={kw.serp?.position}
                      previous={kw.serp?.previous_position}
                      error={kw.serp?.error}
                      stale={kw.serp?.stale}
                    />
                  </td>
                  <td className="px-2 py-2.5 hidden lg:table-cell">
                    <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 max-w-[220px]">
                      {(kw.serp?.competitors || []).slice(0, 3).map((c, i) => (
                        <span key={i} className="truncate" title={c.url}>
                          {c.position}. {c.domain}
                        </span>
                      ))}
                      {!kw.serp?.competitors?.length && !kw.serp?.error && (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 hidden sm:table-cell sm:px-5">
                    {formatDate(kw.serp?.fetched_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-[10px] text-slate-400 sm:px-5">
        P1 se refresca diario 04:00 UTC · completo domingos 05:00 UTC · Playwright (Google → Bing fallback)
      </div>
    </section>
  );
}