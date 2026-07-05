import React, { useMemo } from 'react';
import { usePresupuestoLibre } from '../contexts/PresupuestoLibreContext';
import {
  PANELS_TECHO, PANELS_PARED, PERFIL_TECHO, PERFIL_PARED,
  FIJACIONES, HERRAMIENTAS, SELLADORES, LISTA_ACTIVA,
} from '../data/constants';
import { computePresupuestoLibreCatalogo, flattenPerfilesLibre } from '../utils/presupuestoLibreCatalogo';
import { fmtPrice } from '../utils/helpers';

// Static catalog lookups — computed once at module load.
const PERFIL_ROWS = flattenPerfilesLibre(PERFIL_TECHO, PERFIL_PARED);
const PERFIL_BY_ID = new Map(PERFIL_ROWS.map((r) => [r.id, r]));
const PANEL_FAMILIES = { ...PANELS_TECHO, ...PANELS_PARED };

const isLineComplete = (line) =>
  line?.familia && line?.espesor && Number(line?.m2) > 0;

function CartRow({ label, detail, qty, unidad, onQty, onRemove, muted }) {
  return (
    <div className={`pl-cart__row ${muted ? 'is-muted' : ''}`}>
      <div className="pl-cart__row-info">
        <span className="pl-cart__row-label">{label}</span>
        {detail && <span className="pl-cart__row-detail">{detail}</span>}
      </div>
      <div className="pl-cart__row-controls">
        {onQty && (
          <input
            type="number"
            className="pl-cart__qty-input"
            value={qty}
            min="0"
            onChange={(e) => {
              const v = Number(e.target.value);
              onQty(Number.isFinite(v) ? Math.max(0, v) : 0);
            }}
          />
        )}
        {unidad && <span className="pl-cart__row-unidad">{unidad}</span>}
        <button className="pl-cart__remove" onClick={onRemove} aria-label={`Quitar ${label}`}>
          ✕
        </button>
      </div>
    </div>
  );
}

export function PresupuestoLibreCart() {
  const {
    librePanelLines, updatePanelLine, removePanelLine,
    librePerfilQty, updatePerfilQty, removePerfil,
    libreFijQty, updateFijacionQty, removeFijacion,
    libreSellQty, updateSelladorQty, removeSellador,
    libreExtra, flete, setFlete,
    clearAll,
  } = usePresupuestoLibre();

  // Totals via the same engine the calculator uses. LISTA_ACTIVA is a
  // non-reactive module variable and this uses the base catalog (not the
  // calculator's pricing overrides) — acceptable v1 drift, the calculator's
  // groups table is the authoritative quote.
  const results = useMemo(() => computePresupuestoLibreCatalogo({
    listaPrecios: LISTA_ACTIVA,
    librePanelLines,
    librePerfilQty,
    perfilCatalogById: PERFIL_BY_ID,
    libreFijQty,
    libreSellQty,
    flete,
    libreExtra,
  }), [librePanelLines, librePerfilQty, libreFijQty, libreSellQty, flete, libreExtra]);

  const perfilEntries = Object.entries(librePerfilQty).filter(([, q]) => q > 0);
  const fijEntries = Object.entries(libreFijQty).filter(([, q]) => q > 0);
  const sellEntries = Object.entries(libreSellQty).filter(([, q]) => q > 0);
  const hasExtra = libreExtra?.texto && Number(libreExtra?.precio) > 0;

  const isEmpty = librePanelLines.length === 0 && perfilEntries.length === 0
    && fijEntries.length === 0 && sellEntries.length === 0 && !hasExtra && !(flete > 0);

  if (isEmpty) {
    return (
      <div className="pl-cart pl-cart--empty">
        <p>El carrito está vacío. Agregá productos desde las otras pestañas — aparecen también en el presupuesto del calculador.</p>
      </div>
    );
  }

  const handleClear = () => {
    if (window.confirm('¿Vaciar el carrito completo? También se limpia el presupuesto libre del calculador.')) {
      clearAll();
    }
  };

  return (
    <div className="pl-cart">
      {librePanelLines.length > 0 && (
        <section className="pl-cart__section">
          <h4 className="pl-cart__section-title">Paneles</h4>
          {librePanelLines.map((line) => {
            const familiaLabel = PANEL_FAMILIES[line.familia]?.label;
            return isLineComplete(line) ? (
              <CartRow
                key={line.id}
                label={familiaLabel || line.familia}
                detail={`${line.espesor}mm · ${line.color || '—'}`}
                qty={line.m2}
                unidad="m²"
                onQty={(v) => updatePanelLine(line.id, { m2: v })}
                onRemove={() => removePanelLine(line.id)}
              />
            ) : (
              <CartRow
                key={line.id}
                label="Línea incompleta"
                detail={familiaLabel ? `${familiaLabel} — completar en el calculador` : 'completar en el calculador'}
                onRemove={() => removePanelLine(line.id)}
                muted
              />
            );
          })}
        </section>
      )}

      {perfilEntries.length > 0 && (
        <section className="pl-cart__section">
          <h4 className="pl-cart__section-title">Perfilería</h4>
          {perfilEntries.map(([id, qty]) => (
            <CartRow
              key={id}
              label={PERFIL_BY_ID.get(id)?.label ?? id}
              qty={qty}
              unidad="un"
              onQty={(v) => updatePerfilQty(id, v)}
              onRemove={() => removePerfil(id)}
            />
          ))}
        </section>
      )}

      {fijEntries.length > 0 && (
        <section className="pl-cart__section">
          <h4 className="pl-cart__section-title">Fijaciones y herramientas</h4>
          {fijEntries.map(([key, qty]) => (
            <CartRow
              key={key}
              label={FIJACIONES[key]?.label || HERRAMIENTAS[key]?.label || key}
              qty={qty}
              unidad="un"
              onQty={(v) => updateFijacionQty(key, v)}
              onRemove={() => removeFijacion(key)}
            />
          ))}
        </section>
      )}

      {sellEntries.length > 0 && (
        <section className="pl-cart__section">
          <h4 className="pl-cart__section-title">Selladores</h4>
          {sellEntries.map(([key, qty]) => (
            <CartRow
              key={key}
              label={SELLADORES[key]?.label || key}
              qty={qty}
              unidad="un"
              onQty={(v) => updateSelladorQty(key, v)}
              onRemove={() => removeSellador(key)}
            />
          ))}
        </section>
      )}

      {flete > 0 && (
        <section className="pl-cart__section">
          <h4 className="pl-cart__section-title">Servicios</h4>
          <CartRow
            label="Flete con entrega en obra"
            qty={flete}
            unidad="USD"
            onQty={(v) => setFlete(v)}
            onRemove={() => setFlete(0)}
          />
        </section>
      )}

      {hasExtra && (
        <section className="pl-cart__section">
          <h4 className="pl-cart__section-title">Extraordinarios</h4>
          <div className="pl-cart__row">
            <div className="pl-cart__row-info">
              <span className="pl-cart__row-label">{libreExtra.texto}</span>
              <span className="pl-cart__row-detail">
                {libreExtra.cantidad || 1} × ${fmtPrice(libreExtra.precio)} — editar en el calculador
              </span>
            </div>
          </div>
        </section>
      )}

      {results.warnings?.length > 0 && (
        <div className="pl-cart__warnings">
          {results.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      <div className="pl-cart__totals">
        <div className="pl-cart__totals-row">
          <span>Subtotal (s/IVA)</span>
          <span>${fmtPrice(results.totales?.subtotalSinIVA)}</span>
        </div>
        <div className="pl-cart__totals-row">
          <span>IVA 22%</span>
          <span>${fmtPrice(results.totales?.iva)}</span>
        </div>
        <div className="pl-cart__totals-row pl-cart__totals-row--grand">
          <span>Total</span>
          <span>${fmtPrice(results.totales?.totalFinal)}</span>
        </div>
      </div>

      <button className="pl-cart__clear" onClick={handleClear}>
        Vaciar carrito
      </button>
    </div>
  );
}
