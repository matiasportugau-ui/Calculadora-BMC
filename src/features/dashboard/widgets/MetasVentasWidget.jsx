import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

const FMT = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });

export default function MetasVentasWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['metas-ventas'],
    queryFn: dashboardApi.metasVentas,
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(() => {
    const list = data?.rows || data?.data || data?.metas || data || [];
    if (!Array.isArray(list)) return [];
    return list.map((r, idx) => {
      const meta = Number(r.meta || r.objetivo || r.target || 0);
      const actual = Number(r.actual || r.alcanzado || r.real || 0);
      const pct = meta > 0 ? Math.min(100, Math.round((actual / meta) * 100)) : 0;
      return {
        id: r.id || idx,
        nombre: r.nombre || r.titulo || r.periodo || `Meta ${idx + 1}`,
        meta,
        actual,
        pct,
      };
    });
  }, [data]);

  return (
    <WidgetShell title="Metas de ventas" subtitle={`${rows.length} objetivos`} loading={isLoading} error={error}>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-stone-500 text-sm">Sin metas configuradas.</div>
      ) : (
        <div className="p-4 space-y-4">
          {rows.map((r) => (
            <div key={r.id}>
              <div className="flex items-baseline justify-between text-sm mb-1">
                <span className="font-medium text-stone-900">{r.nombre}</span>
                <span className="text-xs font-mono text-stone-500">
                  $U {FMT.format(r.actual)} / {FMT.format(r.meta)}
                </span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${r.pct >= 100 ? 'bg-green-500' : r.pct >= 75 ? 'bg-orange-500' : 'bg-stone-400'}`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <div className="text-xs text-stone-500 mt-1">{r.pct}% alcanzado</div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
