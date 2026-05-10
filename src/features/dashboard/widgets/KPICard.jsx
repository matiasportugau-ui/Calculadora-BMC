import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton.jsx';
import { dashboardApi } from '../api.js';

const FMT = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 });
const FMT_PCT = new Intl.NumberFormat('es-UY', { style: 'percent', maximumFractionDigits: 1 });

function pickValue(payload, metric) {
  if (!payload || typeof payload !== 'object') return null;
  // Try several common shapes from bmcDashboard.js
  const direct = payload[metric];
  if (typeof direct === 'number') return direct;
  if (payload.kpis && typeof payload.kpis[metric] === 'number') return payload.kpis[metric];
  if (payload.data && typeof payload.data[metric] === 'number') return payload.data[metric];
  if (payload.totales && typeof payload.totales[metric] === 'number') return payload.totales[metric];
  return null;
}

const FORMATTERS = {
  currency_uyu: (v) => (v == null ? '—' : `$U ${FMT.format(v)}`),
  currency_usd: (v) => (v == null ? '—' : `USD ${FMT.format(v)}`),
  percent:      (v) => (v == null ? '—' : FMT_PCT.format(v > 1 ? v / 100 : v)),
  number:       (v) => (v == null ? '—' : FMT.format(v)),
};

export default function KPICard({ title, metric, format = 'currency_uyu', subtitle, deltaMetric }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-financiero'],
    queryFn: dashboardApi.kpiFinanciero,
    staleTime: 60_000,
  });

  const value = data ? pickValue(data, metric) : null;
  const delta = data && deltaMetric ? pickValue(data, deltaMetric) : null;
  const fmt = FORMATTERS[format] || FORMATTERS.number;

  return (
    <div className="h-full p-4 flex flex-col justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide text-stone-500 font-medium">{title}</div>
        {subtitle && <div className="text-[10px] text-stone-400 mt-0.5">{subtitle}</div>}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold tracking-tight text-stone-900">
          {isLoading ? <Skeleton className="h-8 w-24" /> : error ? <span className="text-sm text-red-600">Error</span> : fmt(value)}
        </div>
        {delta != null && (
          <div className={`flex items-center gap-1 text-xs ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-stone-500'}`}>
            {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}
