import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton.jsx';

/**
 * WidgetShell — header consistente para los widgets de tabla/gráfico.
 * El KPICard usa su propio layout más compacto.
 */
export function WidgetShell({ title, subtitle, action, children, loading, error }) {
  return (
    <div className="h-full flex flex-col">
      <header className="flex items-start justify-between px-4 py-3 border-b border-stone-100 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="no-drag">{action}</div>}
      </header>
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : error ? (
          <div className="p-4 flex items-start gap-2 text-sm text-red-700 bg-red-50">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">No se pudieron cargar los datos</div>
              <div className="text-xs text-red-600 mt-1 font-mono">{String(error.message || error).slice(0, 200)}</div>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
