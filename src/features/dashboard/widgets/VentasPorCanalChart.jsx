import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

const FMT = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });

const COLORS = {
  shopify: '#16a34a',
  meli:    '#eab308',
  wa:      '#0ea5e9',
  b2b:     '#c96442',
  otros:   '#a8a29e',
};

function aggregateByChannel(rows) {
  if (!Array.isArray(rows)) return [];
  const buckets = {};
  rows.forEach((r) => {
    const channel = String(r.canal || r.channel || r.origen || 'otros').toLowerCase();
    const key = ['shopify', 'meli', 'mercadolibre', 'wa', 'whatsapp', 'b2b'].includes(channel)
      ? (channel === 'mercadolibre' ? 'meli' : channel === 'whatsapp' ? 'wa' : channel)
      : 'otros';
    const amount = Number(r.total || r.monto || r.importe || 0);
    if (!Number.isFinite(amount)) return;
    const month = String(r.mes || r.month || (r.fecha || '').slice(0, 7) || 'Sin fecha');
    if (!buckets[month]) buckets[month] = { month };
    buckets[month][key] = (buckets[month][key] || 0) + amount;
  });
  return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
}

export default function VentasPorCanalChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ventas'],
    queryFn: () => dashboardApi.ventas(),
    staleTime: 5 * 60_000,
  });

  const chartData = useMemo(() => {
    const rows = data?.rows || data?.data || data?.ventas || data || [];
    return aggregateByChannel(Array.isArray(rows) ? rows : []);
  }, [data]);

  const channels = useMemo(() => {
    const set = new Set();
    chartData.forEach((row) => Object.keys(row).forEach((k) => k !== 'month' && set.add(k)));
    return Array.from(set);
  }, [chartData]);

  return (
    <WidgetShell
      title="Ventas por canal"
      subtitle="Últimos 12 meses (Shopify, Mercado Libre, WhatsApp, B2B)"
      loading={isLoading}
      error={error}
    >
      {chartData.length === 0 ? (
        <div className="p-4 text-sm text-stone-500">Sin datos disponibles aún.</div>
      ) : (
        <div className="h-full w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#78716c" />
              <YAxis tick={{ fontSize: 11 }} stroke="#78716c" tickFormatter={(v) => FMT.format(v)} />
              <Tooltip
                formatter={(v) => `$U ${FMT.format(v)}`}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e5e4' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {channels.map((ch) => (
                <Bar key={ch} dataKey={ch} stackId="ventas" fill={COLORS[ch] || '#a8a29e'} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetShell>
  );
}
