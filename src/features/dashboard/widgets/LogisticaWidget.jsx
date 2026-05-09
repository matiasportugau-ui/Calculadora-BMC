import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

export default function LogisticaWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['coordinacion-logistica'],
    queryFn: dashboardApi.coordinacionLogistica,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const list = data?.rows || data?.data || data?.coordinaciones || data || [];
    return Array.isArray(list) ? list : [];
  }, [data]);

  return (
    <WidgetShell title="Coordinación logística" subtitle={`${rows.length} pendientes`} loading={isLoading} error={error}>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-stone-500 text-sm">Sin coordinaciones abiertas.</div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((r, idx) => (
            <li key={r.id || idx} className="px-4 py-3 hover:bg-stone-50/50">
              <div className="text-sm text-stone-900 font-medium">{r.cliente || r.customer || r.titulo || '—'}</div>
              <div className="text-xs text-stone-500 mt-1">
                {r.fecha || r.scheduled_for || ''} {r.estado && `· ${r.estado}`}
              </div>
              {r.observaciones && <div className="text-xs text-stone-400 italic mt-1">{r.observaciones}</div>}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
