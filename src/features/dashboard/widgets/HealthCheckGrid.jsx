import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

function StatusIcon({ status }) {
  if (status === 'ok') return <CheckCircle2 size={20} className="text-green-600" />;
  if (status === 'warn') return <AlertTriangle size={20} className="text-amber-600" />;
  return <XCircle size={20} className="text-red-600" />;
}

function Service({ name, status, detail }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 bg-white">
      <StatusIcon status={status} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900 truncate">{name}</div>
        <div className="text-xs text-stone-500 truncate">{detail}</div>
      </div>
    </div>
  );
}

export default function HealthCheckGrid() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['health'],
    queryFn: dashboardApi.health,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const services = [
    {
      name: 'API panelin-calc',
      status: error ? 'down' : isLoading ? 'warn' : 'ok',
      detail: error ? String(error.message || error).slice(0, 80) : isLoading ? 'Comprobando…' : 'Cloud Run · us-central1',
    },
    {
      name: 'Google Sheets',
      status: data?.sheets === false ? 'down' : data?.sheets === 'warn' ? 'warn' : data ? 'ok' : 'warn',
      detail: data?.sheetsDetail || (data?.sheets ? 'OK' : 'Esperando respuesta'),
    },
    {
      name: 'Token store (ML)',
      status: data?.tokenStore === false ? 'down' : data?.tokenStore === 'warn' ? 'warn' : data ? 'ok' : 'warn',
      detail: data?.tokenStoreDetail || (data?.tokenStore ? 'Encriptado' : '—'),
    },
    {
      name: 'Frontend Vercel',
      status: typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? 'ok' : 'ok',
      detail: typeof window !== 'undefined' ? window.location.hostname : '',
    },
  ];

  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('es-UY') : '—';

  return (
    <WidgetShell title="Health check" subtitle={`Última actualización: ${updated} · auto-refresh 30s`}>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {services.map((s) => (
          <Service key={s.name} {...s} />
        ))}
      </div>
    </WidgetShell>
  );
}
