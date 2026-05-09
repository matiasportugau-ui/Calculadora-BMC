import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { Badge } from '../../../components/ui/badge.jsx';
import { WidgetShell } from './WidgetShell.jsx';
import { dashboardApi } from '../api.js';

export default function StockWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-ecommerce'],
    queryFn: dashboardApi.stockEcommerce,
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(() => {
    const list = data?.rows || data?.data || data?.stock || data || [];
    if (!Array.isArray(list)) return [];
    return list.map((r, idx) => ({
      id: r.codigo || r.sku || idx,
      sku: r.codigo || r.sku || '—',
      nombre: r.nombre || r.descripcion || r.producto || '',
      stock: Number(r.stock || r.cantidad || r.qty || 0),
      minimo: Number(r.minimo || r.min || 0),
    })).sort((a, b) => a.stock - b.stock);
  }, [data]);

  return (
    <WidgetShell title="Stock e-commerce" subtitle={`${rows.length} productos`} loading={isLoading} error={error}>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-stone-500 text-sm flex flex-col items-center gap-2">
          <Package size={24} className="text-stone-300" />
          Sin datos de stock.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-stone-500 border-b border-stone-100 sticky top-0 bg-white">
            <tr>
              <th className="text-left py-2 px-4 font-medium">SKU</th>
              <th className="text-left py-2 px-4 font-medium">Nombre</th>
              <th className="text-right py-2 px-4 font-medium">Stock</th>
              <th className="text-center py-2 px-4 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r) => {
              const low = r.minimo > 0 && r.stock <= r.minimo;
              const zero = r.stock <= 0;
              return (
                <tr key={r.id} className="border-b border-stone-50">
                  <td className="py-2 px-4 font-mono text-xs">{r.sku}</td>
                  <td className="py-2 px-4 text-stone-700">{r.nombre}</td>
                  <td className="py-2 px-4 text-right font-mono">{r.stock}</td>
                  <td className="py-2 px-4 text-center">
                    {zero ? <Badge variant="danger">Sin stock</Badge>
                      : low ? <Badge variant="warn">Bajo</Badge>
                      : <Badge variant="success">OK</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </WidgetShell>
  );
}
