// ═══════════════════════════════════════════════════════════════════════════
// PriceHUD.jsx — HUD de precio en vivo (la firma de la capa game-like).
// Rama claude/liquid-glass-quoter. Solo se monta dentro de DesignPreviewGate.
//
// Integración (cero duplicación de lógica de precios):
// - Recibe `totals` = el objeto que ya produce calcTotalesSinIVA vía el
//   useMemo `grandTotal` del cotizador canónico (PanelinCalculadoraV3_backup,
//   ~línea 3735). El HUD NO calcula precios: refleja el estado real.
// - IVA 22% se muestra una sola vez a nivel total, usando IVA_MULT de
//   src/data/constants.js (misma fuente que producción).
// - `onWhatsApp` conecta con el flujo wa.me existente del canónico.
//
// Forma esperada de `totals` (defensiva ante campos ausentes):
//   { paneles, fijaciones, perfiles, otros, subtotal } — todo SIN IVA.
//   Si la forma real difiere, el HUD degrada a mostrar solo subtotal+IVA.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import "../../styles/lg-quoter.css";

const fmt = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";

// Forma real (hecho confirmado, calculations.js:907-914):
// calcTotalesSinIVA → { subtotalSinIVA, iva, totalFinal }. El IVA ya viene
// calculado una sola vez a nivel total: el HUD NUNCA lo recalcula.
export default function PriceHUD({ totals, groups, currency = "USD", onWhatsApp }) {
  const subtotal = Number.isFinite(totals?.subtotalSinIVA) ? totals.subtotalSinIVA : 0;
  const iva = Number.isFinite(totals?.iva) ? totals.iva : 0;
  const totalConIVA = Number.isFinite(totals?.totalFinal) ? totals.totalFinal : 0;

  // Desglose opcional por grupos del BOM (misma fuente que la tabla del cotizador)
  const rows = Array.isArray(groups)
    ? groups
        .map((g) => ({
          label: g?.label || g?.nombre || g?.id || "",
          total: Array.isArray(g?.items)
            ? +g.items.reduce((s, i) => s + (i?.total || 0), 0).toFixed(2)
            : null,
        }))
        .filter((r) => r.label && Number.isFinite(r.total) && r.total > 0)
        .slice(0, 4)
    : [];

  // Delta respecto al render anterior + tick de escala (respeta reduced-motion vía CSS)
  const prev = useRef(totalConIVA);
  const [delta, setDelta] = useState(0);
  const [ticking, setTicking] = useState(false);
  useEffect(() => {
    const d = +(totalConIVA - prev.current).toFixed(2);
    if (d !== 0) {
      setDelta(d);
      setTicking(true);
      const t = setTimeout(() => setTicking(false), 180);
      prev.current = totalConIVA;
      return () => clearTimeout(t);
    }
    return undefined;
  }, [totalConIVA]);

  const [intPart, decPart] = fmt(totalConIVA).split(",").length === 2
    ? fmt(totalConIVA).split(",")
    : [fmt(totalConIVA), "00"];

  const empty = subtotal <= 0;

  return (
    <aside className="lgq-hud lgq-glass" data-lg-quoter data-testid="lgq-hud" aria-live="polite">
      <div className="lgq-hud__head">
        <span className="lgq-hud__label">Precio en vivo</span>
        <span className="lgq-hud__iva">IVA 22% inc.</span>
      </div>
      <div className={`lgq-hud__price${ticking ? " is-ticking" : ""}`}>
        {currency} {intPart}
        <small>,{decPart}</small>
      </div>
      {delta !== 0 && (
        <span className={`lgq-hud__delta${delta < 0 ? " lgq-hud__delta--down" : ""}`}>
          {delta > 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}{fmt(delta)} último cambio
        </span>
      )}
      {empty ? (
        <div className="lgq-hud__empty">
          Cargá medidas y panel para ver el precio armarse en vivo.
        </div>
      ) : (
        <div className="lgq-hud__rows">
          {rows.map((r) => (
            <div className="lgq-hud__row" key={r.label}><span>{r.label}</span><b>{fmt(r.total)}</b></div>
          ))}
          <div className="lgq-hud__row"><span>Subtotal s/IVA</span><b>{fmt(subtotal)}</b></div>
          <div className="lgq-hud__row"><span>IVA 22%</span><b>{fmt(iva)}</b></div>
        </div>
      )}
      <button type="button" className="lgq-hud__cta" onClick={onWhatsApp} disabled={empty}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7c1.7.9 3.7 1.5 5.7 1.5 6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.4zM12 21.8c-1.8 0-3.5-.5-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.86 9.86 0 0 1-1.5-5.3c0-5.5 4.4-9.9 9.9-9.9 2.6 0 5.1 1 7 2.9s2.9 4.4 2.9 7c0 5.5-4.5 9.9-9.9 9.9z" />
        </svg>
        Enviar por WhatsApp
      </button>
    </aside>
  );
}
