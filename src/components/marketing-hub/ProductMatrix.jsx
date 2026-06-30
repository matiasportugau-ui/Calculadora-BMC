// Module: market-intelligence | Owner: bmc-dev
// BMC baseline SKU vs tier-weighted market reference + positioning.
// Token-driven (var(--ac-*)) so it inherits the active .adminCot skin.

import React from 'react';

const POSICION = {
  por_debajo: { label: 'Bajo mercado', color: 'var(--ac-success)', bg: 'color-mix(in srgb, var(--ac-success) 14%, transparent)' },
  en_linea:   { label: 'En línea',     color: 'var(--ac-text-2)', bg: 'var(--ac-surface-2)' },
  por_encima: { label: 'Sobre mercado', color: 'var(--ac-warn)',  bg: 'color-mix(in srgb, var(--ac-warn) 14%, transparent)' },
  cotizacion: { label: 'Cotización',   color: 'var(--ac-text-3)', bg: 'var(--ac-surface-2)' },
};

function fmtUsd(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProductMatrix({ rows, loading }) {
  const th = {
    padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)',
    borderBottom: '1px solid var(--ac-border)', background: 'var(--ac-surface-2)',
    position: 'sticky', top: 0,
  };
  const td = { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--ac-border-2)', color: 'var(--ac-text)' };
  const right = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ position: 'relative', overflowX: 'auto', borderRadius: 'var(--ac-radius)', border: '1px solid var(--ac-border)', background: 'var(--ac-surface)' }}>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ac-glass)', backdropFilter: 'blur(2px)', zIndex: 2, color: 'var(--ac-text-2)', fontSize: 13 }}>
          Cargando matriz…
        </div>
      )}
      <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>SKU</th>
            <th style={th}>Producto</th>
            <th style={{ ...th, ...right }}>Precio BMC</th>
            <th style={{ ...th, ...right }}>Ref. mercado*</th>
            <th style={{ ...th, ...right }}>Δ vs mercado</th>
            <th style={{ ...th, textAlign: 'center' }}>Posición</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => {
            const pos = POSICION[r.posicion] || POSICION.cotizacion;
            const deltaColor = r.delta_pct == null ? 'var(--ac-text-3)'
              : r.delta_pct < 0 ? 'var(--ac-success)'
              : r.delta_pct > 0 ? 'var(--ac-warn)' : 'var(--ac-text-2)';
            return (
              <tr key={r.sku}>
                <td style={{ ...td, fontFamily: 'var(--ac-font-mono)', fontSize: 11, color: 'var(--ac-text-2)' }}>{r.sku}</td>
                <td style={td}>
                  <span style={{ fontWeight: 600 }}>{r.producto}</span>
                  {r.espesor_mm != null && <span style={{ color: 'var(--ac-text-3)' }}> · {r.espesor_mm}mm</span>}
                  {r.nucleo && <div style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>{r.nucleo}</div>}
                </td>
                <td style={{ ...td, ...right, fontWeight: 600 }}>{fmtUsd(r.precio_bmc)}</td>
                <td style={{ ...td, ...right, color: 'var(--ac-text-2)' }}>{fmtUsd(r.ref_mercado)}</td>
                <td style={{ ...td, ...right }}>
                  <span style={{ color: deltaColor, fontWeight: 600 }}>
                    {r.delta_pct == null ? '—' : `${r.delta_pct > 0 ? '+' : ''}${r.delta_pct}%`}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: pos.color, background: pos.bg }}>
                    {pos.label}
                  </span>
                </td>
              </tr>
            );
          })}
          {!loading && (!rows || rows.length === 0) && (
            <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--ac-text-3)', padding: '28px 14px' }}>Sin datos de productos.</td></tr>
          )}
        </tbody>
      </table>
      <p style={{ margin: 0, padding: '8px 14px', fontSize: 11, color: 'var(--ac-text-3)', borderTop: '1px solid var(--ac-border-2)' }}>
        *Referencia de mercado estimada con multiplicadores por tier de competidor (no es un precio de competidor en vivo).
      </p>
    </div>
  );
}
