// Module: market-intelligence | Owner: bmc-dev
// Active go-to-market strategies. Seeded from data/strategies.json (grounded in
// the captured technical/pricing intel) and enriched with the AI brief's
// oportunidades / recomendaciones when a brief has been generated.

import React from 'react';
import SEED_STRATEGIES from './data/strategies.json';

function Card({ children, style }) {
  return (
    <div style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', padding: 16, boxShadow: 'var(--ac-shadow-1)', ...style }}>
      {children}
    </div>
  );
}

export default function StrategyCards({ strategies = SEED_STRATEGIES, brief }) {
  const oportunidades = Array.isArray(brief?.oportunidades) ? brief.oportunidades.slice(0, 4) : [];
  const recomendaciones = Array.isArray(brief?.recomendaciones) ? brief.recomendaciones.slice(0, 4) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {strategies.map((s, i) => (
          <Card key={s.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ac-text)' }}>
                <span style={{ color: 'var(--ac-text-3)' }}>{i + 1}. </span>{s.titulo}
              </div>
              {s.kpi && (
                <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, color: 'var(--ac-accent)', background: 'color-mix(in srgb, var(--ac-accent) 14%, transparent)' }}>{s.kpi}</span>
              )}
            </div>
            {s.claim && <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--ac-accent)' }}>{s.claim}</div>}
            <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--ac-text-2)' }}>{s.detalle}</p>
            {s.fundamento && (
              <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.45, color: 'var(--ac-text-3)', borderTop: '1px solid var(--ac-border-2)', paddingTop: 8 }}>
                <strong style={{ color: 'var(--ac-text-2)' }}>Fundamento:</strong> {s.fundamento}
              </p>
            )}
          </Card>
        ))}
      </div>

      {(oportunidades.length > 0 || recomendaciones.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {oportunidades.length > 0 && (
            <Card>
              <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)', marginBottom: 10 }}>Oportunidades (brief AI)</div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {oportunidades.map((o, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--ac-text)', lineHeight: 1.45 }}>
                    <strong>{o.producto || o.categoria || 'Oportunidad'}:</strong> {o.descripcion}
                    {o.impacto && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ac-text-3)' }}>[{o.impacto}]</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {recomendaciones.length > 0 && (
            <Card>
              <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)', marginBottom: 10 }}>Recomendaciones (brief AI)</div>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recomendaciones.map((r, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--ac-text)', lineHeight: 1.45 }}>
                    <strong>{r.area || 'Acción'}:</strong> {r.accion}
                    {r.prioridad && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--ac-text-3)' }}>[{r.prioridad}]</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
