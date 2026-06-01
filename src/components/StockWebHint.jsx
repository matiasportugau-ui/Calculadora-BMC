// ═══════════════════════════════════════════════════════════════════════════
// StockWebHint.jsx
// Muestra advertencias de stock cuando se usa la lista "web" (Precio Web).
// Consume el Productos Maestro para dar visibilidad real del inventario.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { getCalcApiBase } from '../utils/calcApiBase.js';
import { C, FONT } from '../data/constants.js';

const API_BASE = getCalcApiBase();

export default function StockWebHint({ listaPrecios }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const isWeb = (listaPrecios || 'web') === 'web';

  useEffect(() => {
    if (!isWeb) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/productos-maestro`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;

        const items = json.items || [];
        const lowStock = items.filter(it => 
          it.stock && 
          (it.stock.actual || 0) < 5 && 
          (it.linkStatus === 'linked' || it.sources?.stock)
        );

        setData({
          total: items.length,
          lowStockCount: lowStock.length,
          lowStockItems: lowStock.slice(0, 5), // top 5 for the hint
        });
      })
      .catch(() => {
        if (!cancelled) setData({ error: true });
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [isWeb]); // API_BASE is stable, no need to include

  if (!isWeb) return null;

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: C.ts, marginTop: 6, fontFamily: FONT }}>
        Consultando stock maestro…
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div style={{ fontSize: 11, color: C.ts, marginTop: 4, fontFamily: FONT, opacity: 0.7 }}>
        No se pudo consultar el stock del Maestro. Usa Config → Productos para verificar.
      </div>
    );
  }

  const { lowStockCount, lowStockItems = [] } = data;

  if (lowStockCount === 0) {
    return (
      <div style={{ fontSize: 11, color: '#166534', marginTop: 4, fontFamily: FONT }}>
        ✓ Stock maestro OK para lista Web (sin productos críticos bajos).
      </div>
    );
  }

  const examples = lowStockItems
    .map(i => i.nombre || i.sku || i.codigo)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  return (
    <div style={{
      marginTop: 6,
      padding: '6px 10px',
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: 6,
      fontSize: 12,
      color: '#991b1b',
      fontFamily: FONT,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>
          ⚠️ <strong>{lowStockCount}</strong> producto(s) con stock bajo (&lt; 5) según el Maestro para venta web.
        </span>
        <a 
          href="#config" 
          onClick={() => {
            console.info('[StockWebHint] Abre Config → Productos (Maestro) para ver detalle');
          }}
          style={{ color: '#b91c1c', textDecoration: 'underline', fontSize: 11, whiteSpace: 'nowrap' }}
        >
          Ver en Maestro
        </a>
      </div>
      {examples && (
        <div style={{ fontSize: 11, opacity: 0.85 }}>
          Ej: {examples}...
        </div>
      )}
    </div>
  );
}
