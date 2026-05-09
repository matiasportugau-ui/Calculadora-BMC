import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../../components/ui/badge.jsx';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

const FMT = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });

function bucketOfDays(days) {
  if (days >= 0) return 'current';
  if (days >= -30) return '1-30';
  if (days >= -60) return '31-60';
  return '60+';
}

function diasHastaVenc(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.valueOf())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d - today) / (1000 * 60 * 60 * 24));
}

export default function PagosPendientesTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pagos-pendientes'],
    queryFn: dashboardApi.pagosPendientes,
    staleTime: 2 * 60_000,
  });

  const rows = useMemo(() => {
    const list = data?.rows || data?.data || data?.pagos || data || [];
    if (!Array.isArray(list)) return [];
    return list
      .map((r, idx) => {
        const venc = r.vencimiento || r.fecha_vencimiento || r.due_date || r.fecha;
        const dias = diasHastaVenc(venc);
        return {
          id: r.id || idx,
          cliente: r.cliente || r.customer || r.razon_social || r.nombre || '—',
          factura: r.factura || r.invoice || r.numero || r.nro || '',
          monto: Number(r.monto || r.importe || r.amount || r.saldo || 0),
          vencimiento: venc || '',
          dias,
          bucket: dias != null ? bucketOfDays(dias) : 'current',
        };
      })
      .sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999));
  }, [data]);

  const totals = useMemo(() => {
    const acc = { current: 0, '1-30': 0, '31-60': 0, '60+': 0 };
    rows.forEach((r) => { acc[r.bucket] = (acc[r.bucket] || 0) + r.monto; });
    return acc;
  }, [rows]);

  return (
    <WidgetShell title="Pagos pendientes — aging" subtitle={`${rows.length} cuentas abiertas`} loading={isLoading} error={error}>
      <div className="grid grid-cols-4 gap-2 px-4 py-3 text-xs border-b border-stone-100 bg-stone-50/50">
        <Bucket label="Al día" value={totals.current} variant="success" />
        <Bucket label="1-30 días" value={totals['1-30']} variant="warn" />
        <Bucket label="31-60 días" value={totals['31-60']} variant="warn" />
        <Bucket label="60+ días" value={totals['60+']} variant="danger" />
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-stone-500 border-b border-stone-100 sticky top-0 bg-white">
          <tr>
            <th className="text-left py-2 px-4 font-medium">Cliente</th>
            <th className="text-left py-2 px-4 font-medium">Factura</th>
            <th className="text-right py-2 px-4 font-medium">Monto</th>
            <th className="text-left py-2 px-4 font-medium">Vencimiento</th>
            <th className="text-center py-2 px-4 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="p-6 text-center text-stone-500 text-sm">Sin pagos pendientes.</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                <td className="py-2 px-4">{r.cliente}</td>
                <td className="py-2 px-4 text-stone-500">{r.factura || '—'}</td>
                <td className="py-2 px-4 text-right font-mono">$U {FMT.format(r.monto)}</td>
                <td className="py-2 px-4 text-stone-500">{r.vencimiento}</td>
                <td className="py-2 px-4 text-center">
                  <BucketBadge bucket={r.bucket} dias={r.dias} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </WidgetShell>
  );
}

function Bucket({ label, value, variant }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`text-sm font-semibold ${variant === 'danger' ? 'text-red-700' : variant === 'warn' ? 'text-amber-700' : 'text-green-700'}`}>
        $U {FMT.format(value)}
      </div>
    </div>
  );
}

function BucketBadge({ bucket, dias }) {
  if (bucket === 'current') return <Badge variant="success">Al día</Badge>;
  if (bucket === '1-30') return <Badge variant="warn">{Math.abs(dias)}d</Badge>;
  if (bucket === '31-60') return <Badge variant="warn">{Math.abs(dias)}d</Badge>;
  return <Badge variant="danger">{Math.abs(dias)}d</Badge>;
}
