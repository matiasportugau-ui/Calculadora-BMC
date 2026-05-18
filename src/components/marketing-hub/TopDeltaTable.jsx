// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import React from 'react';

function pctColor(pct) {
  const abs = Math.abs(pct);
  const up  = pct > 0;
  if (abs >= 15) return { bg: up ? '#fff1f0' : '#f6ffed', text: up ? '#cf1322' : '#389e0d' };
  if (abs >= 5)  return { bg: up ? '#fffbe6' : '#e6f4ff', text: up ? '#d46b08' : '#0958d9' };
  return { bg: '#f5f5f5', text: '#595959' };
}

export default function TopDeltaTable({ rows }) {
  const th = { padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#8c8c8c', borderBottom: '1px solid #f0f0f0', background: '#fafafa' };
  const td = { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #f5f5f7' };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e5ea' }}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Competidor', 'SKU', 'Precio ant.', 'Precio act.', 'Variación', 'Última vez'].map(h => (
              <th key={h} style={{ ...th, textAlign: h.includes('Precio') || h === 'Variación' || h === 'Última vez' ? 'right' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const c = pctColor(Number(row.pct_change));
            return (
              <tr key={`${row.competitor_id}-${row.sku_id}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={td}>
                  <p style={{ margin: 0, fontWeight: 600, color: '#1a3a5c' }}>{row.competitor_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{row.domain}</p>
                </td>
                <td style={{ ...td, color: '#595959' }}>{row.sku_name}</td>
                <td style={{ ...td, textAlign: 'right', color: '#8c8c8c' }}>${Number(row.price_before).toLocaleString('es-UY', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#1a3a5c' }}>${Number(row.price_after).toLocaleString('es-UY', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text }}>
                    {Number(row.pct_change) > 0 ? '+' : ''}{Number(row.pct_change).toFixed(2)}%
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right', fontSize: 12, color: '#aaa' }}>
                  {new Date(row.last_seen).toLocaleDateString('es-UY')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
