import React from 'react';
import { GitBranch, Server, Globe } from 'lucide-react';
import { WidgetShell } from './WidgetShell.jsx';

export default function BuildInfoWidget() {
  const branch  = import.meta.env.VITE_GIT_BRANCH  || 'local';
  const version = import.meta.env.VITE_APP_VERSION || '—';
  const items = [
    { icon: <GitBranch size={14} />, label: 'Branch',   value: branch },
    { icon: <Server size={14} />,    label: 'API',      value: 'panelin-calc · us-central1' },
    { icon: <Globe size={14} />,     label: 'Frontend', value: typeof window !== 'undefined' ? window.location.host : '' },
    { icon: <Server size={14} />,    label: 'Versión',  value: version },
  ];
  return (
    <WidgetShell title="Build info" subtitle="Estado del despliegue">
      <ul className="p-4 space-y-3">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-3 text-sm">
            <span className="text-stone-400">{it.icon}</span>
            <span className="text-xs uppercase tracking-wide text-stone-500 w-20">{it.label}</span>
            <span className="text-stone-900 font-mono text-xs truncate">{it.value}</span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
