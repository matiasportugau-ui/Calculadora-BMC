import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge } from '../../../components/ui/badge.jsx';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

const FMT = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });

const STATUS_VARIANT = {
  borrador: 'default',
  enviada:  'info',
  aceptada: 'success',
  rechazada:'danger',
  vencida:  'warn',
  pendiente:'info',
};

export default function CotizacionesTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cotizaciones'],
    queryFn: dashboardApi.cotizaciones,
    staleTime: 60_000,
  });
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const list = data?.rows || data?.data || data?.cotizaciones || data || [];
    if (!Array.isArray(list)) return [];
    return list.map((r, idx) => ({
      id: r.id || idx,
      numero: r.numero || r.id_cotizacion || r.cot || '',
      cliente: r.cliente || r.customer || r.razon_social || '—',
      escenario: r.escenario || r.tipo || '',
      total: Number(r.total || r.monto || r.importe || 0),
      estado: String(r.estado || r.status || 'borrador').toLowerCase(),
      fecha: r.fecha || r.created_at || r.creado || '',
    }));
  }, [data]);

  const filtered = useMemo(() => {
    if (!filter) return rows;
    const f = filter.toLowerCase();
    return rows.filter((r) =>
      [r.numero, r.cliente, r.escenario, r.estado].some((v) => String(v).toLowerCase().includes(f))
    );
  }, [rows, filter]);

  return (
    <WidgetShell
      title="Cotizaciones"
      subtitle={`${filtered.length} de ${rows.length}`}
      loading={isLoading}
      error={error}
      action={
        <div className="relative no-drag">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar..."
            className="pl-7 pr-2 py-1 text-xs border border-stone-200 rounded-md w-40 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead className="text-xs text-stone-500 border-b border-stone-100 sticky top-0 bg-white">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Nº</th>
            <th className="text-left py-2 px-4 font-medium">Cliente</th>
            <th className="text-left py-2 px-4 font-medium">Escenario</th>
            <th className="text-right py-2 px-4 font-medium">Total</th>
            <th className="text-center py-2 px-4 font-medium">Estado</th>
            <th className="text-left py-2 px-4 font-medium">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={6} className="p-6 text-center text-stone-500">Sin cotizaciones.</td></tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                <td className="py-2 px-4 font-mono text-xs">{r.numero || '—'}</td>
                <td className="py-2 px-4">{r.cliente}</td>
                <td className="py-2 px-4 text-stone-500 text-xs">{r.escenario || '—'}</td>
                <td className="py-2 px-4 text-right font-mono">$U {FMT.format(r.total)}</td>
                <td className="py-2 px-4 text-center">
                  <Badge variant={STATUS_VARIANT[r.estado] || 'default'}>{r.estado}</Badge>
                </td>
                <td className="py-2 px-4 text-stone-500 text-xs">{r.fecha}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </WidgetShell>
  );
}
