import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { Badge } from '../../../components/ui/badge.jsx';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

export default function EntregasTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['proximas-entregas'],
    queryFn: dashboardApi.proximasEntregas,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const list = data?.rows || data?.data || data?.entregas || data || [];
    if (!Array.isArray(list)) return [];
    return list.map((r, idx) => ({
      id: r.id || idx,
      cliente: r.cliente || r.customer || '—',
      fecha: r.fecha || r.scheduled_for || r.fecha_entrega || '',
      direccion: r.direccion || r.address || r.zona || '',
      estado: String(r.estado || r.status || 'planeada').toLowerCase(),
      observaciones: r.observaciones || r.notas || '',
    }));
  }, [data]);

  return (
    <WidgetShell title="Próximas entregas" subtitle={`${rows.length} programadas`} loading={isLoading} error={error}>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-stone-500 text-sm flex flex-col items-center gap-2">
          <Truck size={24} className="text-stone-300" />
          Sin entregas programadas.
        </div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 hover:bg-stone-50/50">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm text-stone-900">{r.cliente}</div>
                <Badge variant={r.estado === 'entregada' ? 'success' : r.estado === 'en_ruta' ? 'info' : 'default'}>
                  {r.estado}
                </Badge>
              </div>
              <div className="text-xs text-stone-500 mt-1">
                {r.fecha} {r.direccion && `· ${r.direccion}`}
              </div>
              {r.observaciones && (
                <div className="text-xs text-stone-400 mt-1 italic">{r.observaciones}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
