// Module: market-intelligence | Owner: bmc-dev
// "Inteligencia" tab — surfaces the offline market investigation captured in the
// repo: 31-competitor tier map, Meta Ads audit, MercadoLibre pulse.
// Data comes from GET /api/marketing/intel ({ competitors, ads, ml }).

import React from 'react';
import KeywordMonitor from './KeywordMonitor.jsx';

const TIER_COLOR = {
  1: 'var(--ac-error)',
  2: 'var(--ac-warn)',
  3: 'var(--ac-accent)',
  4: 'var(--ac-text-2)',
  5: 'var(--ac-text-3)',
};
const SEV_COLOR = { alta: 'var(--ac-error)', media: 'var(--ac-warn)', baja: 'var(--ac-text-2)' };

function Section({ title, meta, children }) {
  return (
    <section style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: 'var(--ac-radius)', padding: 18, boxShadow: 'var(--ac-shadow-1)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>{title}</h3>
        {meta && <span style={{ fontSize: 12, color: 'var(--ac-text-3)' }}>{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border-2)', borderRadius: 'var(--ac-radius-sm)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-3)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: accent || 'var(--ac-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function tilesGrid(children) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>{children}</div>;
}

function Competitors({ data }) {
  if (!data) return null;
  const tiers = data.tiers || {};
  const rows = data.product_family_mapping || [];
  const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)', borderBottom: '1px solid var(--ac-border)', background: 'var(--ac-surface-2)', position: 'sticky', top: 0 };
  const td = { padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--ac-border-2)', color: 'var(--ac-text)' };
  return (
    <Section title="Competidores por tier" meta={`${data.total_competidores ?? rows.length} conocidos · captura ${data.fecha_captura ?? 's/f'}`}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {Object.entries(tiers).map(([t, v]) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'var(--ac-text)', background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: TIER_COLOR[t] || 'var(--ac-text-3)' }} />
            T{t} {v.label}: {v.count}
          </span>
        ))}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ac-text-2)', lineHeight: 1.5 }}>
        El ecosistema <strong>Kingspan</strong> (Bromyros + MontFrío) domina EPS/PIR; los <strong>resellers MLU (Tier 5)</strong> presionan precio en EPS 50mm pared.
      </p>
      <div style={{ maxHeight: 360, overflowY: 'auto', borderRadius: 'var(--ac-radius-sm)', border: '1px solid var(--ac-border)' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Competidor</th><th style={{ ...th, textAlign: 'center' }}>Tier</th><th style={th}>Tipo</th><th style={th}>Familia principal</th></tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i}>
                <td style={td}>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noreferrer" style={{ color: 'var(--ac-accent)', textDecoration: 'none', fontWeight: 600 }}>{c.competidor}</a>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{c.competidor}</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ display: 'inline-block', minWidth: 20, padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: 'var(--ac-accent-fg)', background: TIER_COLOR[c.tier] || 'var(--ac-text-3)' }}>{c.tier}</span>
                </td>
                <td style={{ ...td, color: 'var(--ac-text-2)' }}>{c.type}</td>
                <td style={{ ...td, color: 'var(--ac-text-2)', fontSize: 11 }}>{c.familia_principal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Ads({ data, onOpenAdsMeta }) {
  if (!data) return null;
  return (
    <Section title="Auditoría Meta Ads" meta={data.fecha_audit ? `audit ${data.fecha_audit}` : null}>
      {tilesGrid(
        <>
          <Tile label="Campañas" value={data.total_campanas ?? '—'} />
          <Tile label="Activas" value={data.campanas_activas ?? '—'} accent="var(--ac-success)" />
          <Tile label="Zombies" value={data.campanas_zombie ?? '—'} accent="var(--ac-warn)" />
          <Tile label="Inversión/mes" value={data.inversion_total_mensual_usd != null ? `$${Number(data.inversion_total_mensual_usd).toLocaleString('es-UY')}` : '—'} />
        </>
      )}
      {data.diagnostico && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'color-mix(in srgb, var(--ac-warn) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ac-warn) 30%, transparent)', fontSize: 12, color: 'var(--ac-text)' }}>
          <strong>Diagnóstico:</strong> {data.diagnostico}
        </div>
      )}
      {onOpenAdsMeta && (
        <button
          type="button"
          onClick={onOpenAdsMeta}
          style={{
            marginTop: 14,
            fontSize: 12,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 'var(--ac-radius-sm)',
            border: 'none',
            background: 'var(--ac-accent)',
            color: 'var(--ac-accent-fg)',
            cursor: 'pointer',
          }}
        >
          Abrir Ads · Meta (reporte completo) →
        </button>
      )}
      {Array.isArray(data.big_4_campanas) && data.big_4_campanas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)', marginBottom: 8 }}>Big 4 campañas activas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.big_4_campanas.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border-2)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ac-text)' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--ac-text-3)' }}>{c.objetivo} · rendimiento {c.rendimiento}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ac-accent)', fontVariantNumeric: 'tabular-nums' }}>${Number(c.inversion_mensual_usd).toLocaleString('es-UY')}/mes</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.recomendacion_asc && (
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--ac-text-2)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--ac-text)' }}>ASC:</strong> {data.recomendacion_asc}
        </p>
      )}
    </Section>
  );
}

function MlPulse({ data }) {
  if (!data) return null;
  const m = data.metricas || {};
  return (
    <Section title="Pulso MercadoLibre Uruguay" meta={data.fecha_captura ? `captura ${data.fecha_captura}` : null}>
      {tilesGrid(
        <>
          <Tile label="Listings activos" value={m.total_listings_activos ?? '—'} />
          <Tile label="Q&A sin responder" value={m.preguntas_sin_respuesta ?? '—'} accent="var(--ac-error)" />
          <Tile label="Tasa respuesta" value={m.tasa_respuesta ?? '—'} />
          <Tile label="Img. faltantes" value={m.listings_con_imagenes_faltantes ?? '—'} accent="var(--ac-warn)" />
        </>
      )}
      {Array.isArray(data.problemas_identificados) && data.problemas_identificados.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.problemas_identificados.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border-2)' }}>
              <span style={{ flexShrink: 0, marginTop: 2, width: 8, height: 8, borderRadius: 999, background: SEV_COLOR[p.severidad] || 'var(--ac-text-3)' }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--ac-text)' }}>{p.descripcion}</div>
                <div style={{ fontSize: 11, color: 'var(--ac-text-3)', marginTop: 2 }}>→ {p.accion_sugerida}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(data.tendencias_mercado) && data.tendencias_mercado.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ac-text-2)', marginBottom: 8 }}>Tendencias</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.tendencias_mercado.map((t, i) => (
              <span key={i} style={{ padding: '6px 12px', borderRadius: 'var(--ac-radius-sm)', background: 'var(--ac-surface-2)', border: '1px solid var(--ac-border-2)', fontSize: 11, color: 'var(--ac-text-2)' }}>
                <strong style={{ color: 'var(--ac-text)' }}>{t.indicador}:</strong> {t.tendencia} — {t.nota}
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

export default function IntelPanel({ intel, token, onOpenAdsMeta }) {
  if (!intel) {
    return <p style={{ color: 'var(--ac-text-3)', fontSize: 13 }}>Inteligencia de mercado no disponible.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {token && <KeywordMonitor token={token} />}
      <Competitors data={intel.competitors} />
      <Ads data={intel.ads} onOpenAdsMeta={onOpenAdsMeta} />
      <MlPulse data={intel.ml} />
    </div>
  );
}
