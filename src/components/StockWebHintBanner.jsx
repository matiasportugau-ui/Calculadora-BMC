/**
 * StockWebHintBanner — aviso read-only cuando lista activa es web (stock bajo).
 */

import { useEffect, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { C, FONT } from "../data/constants.js";
import { AlertTriangle } from "lucide-react";

export default function StockWebHintBanner({ active }) {
  const [hint, setHint] = useState(null);

  useEffect(() => {
    if (!active) {
      setHint(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base = getCalcApiBase();
        const res = await fetch(`${base}/api/stock-kpi`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if ((data.bajoStock || 0) > 0) {
          setHint({ bajo: data.bajoStock, total: data.totalProductos });
        } else {
          setHint(null);
        }
      } catch {
        if (!cancelled) setHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active || !hint) return null;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: C.warningSoft,
        border: `1px solid ${C.warning}44`,
        fontSize: 12,
        fontFamily: FONT,
        color: C.tp,
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <AlertTriangle size={16} color={C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <strong>Stock e-commerce:</strong> {hint.bajo} de {hint.total} productos con bajo stock (&lt;5 u.).
        Detalle en Config → Productos.
      </div>
    </div>
  );
}
