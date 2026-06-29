import React from 'react';

const badgeColors = {
  alto: { bg: '#fff1f0', color: '#cf1322', border: '#ffccc7' },
  medio: { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
  bajo: { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
};
const signalColors = {
  positiva: { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
  negativa: { bg: '#fff1f0', color: '#cf1322', border: '#ffccc7' },
  neutra: { bg: '#f5f5f7', color: '#666', border: '#e5e5ea' },
};
const priorityColors = {
  alta: { bg: '#fff1f0', color: '#cf1322', border: '#ffccc7' },
  media: { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
  baja: { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
};
const categoryColors = {
  fuerte: { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
  neutral: { bg: '#f5f5f7', color: '#666', border: '#e5e5ea' },
  debíl: { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' },
  sin_datos: { bg: '#f0f0f0', color: '#aaa', border: '#e0e0e0' },
};

function Badge({ label, colors }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 10, ...colors }}>
      {label}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function OpportunityCard({ opp }) {
  const c = badgeColors[opp.impacto] || badgeColors.medio;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, color: '#1a3a5c', margin: 0 }}>{opp.producto}</p>
          <p style={{ fontSize: 11, color: '#888', margin: '2px 0 0' }}>{opp.categoria}</p>
        </div>
        <Badge label={opp.impacto} colors={c} />
      </div>
      <p style={{ fontSize: 12, color: '#555', margin: '6px 0' }}>{opp.descripcion}</p>
      <p style={{ fontSize: 12, color: '#1a3a5c', margin: 0, fontStyle: 'italic' }}>{opp.accion_sugerida}</p>
    </div>
  );
}

function SignalCard({ sig }) {
  const c = signalColors[sig.tipo] || signalColors.neutra;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <p style={{ fontWeight: 600, fontSize: 12, color: '#333', margin: 0 }}>{sig.titulo}</p>
        <Badge label={sig.tipo} colors={c} />
      </div>
      <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>{sig.descripcion}</p>
      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#888' }}>
        {sig.producto_relacionado && <span>Producto: {sig.producto_relacionado}</span>}
        {sig.competidor_relacionado && <span>Competidor: {sig.competidor_relacionado}</span>}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }) {
  const c = priorityColors[rec.prioridad] || priorityColors.media;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <p style={{ fontWeight: 600, fontSize: 12, color: '#333', margin: 0 }}>{rec.accion}</p>
        <Badge label={rec.prioridad} colors={c} />
      </div>
      <p style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Área: {rec.area}</p>
      <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{rec.detalle}</p>
    </div>
  );
}

function CategoryBadge({ cat }) {
  const c = categoryColors[cat.evaluacion] || categoryColors.sin_datos;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 14, flex: '1 1 180px', minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p style={{ fontWeight: 600, fontSize: 12, color: '#1a3a5c', margin: 0 }}>{cat.nombre}</p>
        <Badge label={cat.evaluacion} colors={c} />
      </div>
      <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 12 }}>
        <span>Prod: {cat.productos_monitoreados}</span>
        <span>Compet: {cat.competidores_activos}</span>
      </div>
      {cat.observacion && <p style={{ fontSize: 11, color: '#555', margin: '6px 0 0' }}>{cat.observacion}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 20, width: '40%', background: '#f0f0f0', borderRadius: 4, marginBottom: 16 }} />
      <div style={{ height: 14, width: '80%', background: '#f0f0f0', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 14, width: '60%', background: '#f0f0f0', borderRadius: 4, marginBottom: 24 }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 80, background: '#f5f5f7', borderRadius: 10, marginBottom: 10 }} />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 10, padding: 24, textAlign: 'center' }}>
      <p style={{ fontWeight: 600, color: '#cf1322', marginBottom: 8 }}>Error al generar brief</p>
      <p style={{ fontSize: 13, color: '#820014', marginBottom: 16 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{ fontSize: 13, padding: '8px 16px', background: '#cf1322', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Reintentar
      </button>
    </div>
  );
}

export default function AiStrategicBrief({ brief, loading, error, onRetry }) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!brief) return null;

  const { resumen_ejecutivo, oportunidades, senalas, recomendaciones, categorias, analisis_precios, analisis_ads, analisis_ml } = brief;

  return (
    <div style={{ background: '#fafafa', border: '1px solid #e5e5ea', borderRadius: 12, padding: 24, marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', margin: 0 }}>
          Brief Estratégico AI
        </h2>
        <span style={{ fontSize: 11, color: '#aaa' }}>
          Generado vía {brief.provider || 'AI'}
        </span>
      </div>

      {resumen_ejecutivo && (
        <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#003a8c', margin: 0, lineHeight: 1.5 }}>{resumen_ejecutivo}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {oportunidades?.length > 0 && (
          <Section title="Oportunidades">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {oportunidades.map((o, i) => <OpportunityCard key={i} opp={o} />)}
            </div>
          </Section>
        )}

        {senalas?.length > 0 && (
          <Section title="Señales de mercado">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {senalas.map((s, i) => <SignalCard key={i} sig={s} />)}
            </div>
          </Section>
        )}

        {recomendaciones?.length > 0 && (
          <Section title="Recomendaciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recomendaciones.map((r, i) => <RecommendationCard key={i} rec={r} />)}
            </div>
          </Section>
        )}
      </div>

      {analisis_precios && (
        <Section title="Análisis de Precios">
          {analisis_precios.resumen && (
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>{analisis_precios.resumen}</p>
          )}
          {analisis_precios.brechas?.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f0f5ff' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #d6e4ff', color: '#1a3a5c' }}>Producto</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #d6e4ff', color: '#1a3a5c' }}>BMC USD/m²</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #d6e4ff', color: '#1a3a5c' }}>Mercado USD/m²</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #d6e4ff', color: '#1a3a5c' }}>Diferencia</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #d6e4ff', color: '#1a3a5c' }}>Interpretación</th>
                  </tr>
                </thead>
                <tbody>
                  {analisis_precios.brechas.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#333' }}>{b.producto}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${b.precio_bmc_usd_m2?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${b.precio_referencia_mercado_usd_m2?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: b.diferencia_porcentaje > 0 ? '#cf1322' : '#389e0d' }}>
                        {b.diferencia_porcentaje > 0 ? '+' : ''}{b.diferencia_porcentaje?.toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 12px', color: '#555', fontSize: 11 }}>{b.interpretacion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {analisis_precios.recomendacion_precios && (
            <p style={{ fontSize: 13, color: '#1a3a5c', marginTop: 12, fontStyle: 'italic' }}>
              {analisis_precios.recomendacion_precios}
            </p>
          )}
        </Section>
      )}

      {analisis_ads && (
        <Section title="Análisis de Meta Ads">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Total campañas</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0 }}>{analisis_ads.total_campanas}</p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Activas</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#389e0d', margin: 0 }}>{analisis_ads.campanas_activas}</p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Zombies</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#cf1322', margin: 0 }}>{analisis_ads.campanas_zombie}</p>
            </div>
          </div>
          {analisis_ads.resumen && (
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>{analisis_ads.resumen}</p>
          )}
          {analisis_ads.diagnostico && (
            <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#d46b08', margin: '0 0 4px' }}>Diagnóstico</p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{analisis_ads.diagnostico}</p>
            </div>
          )}
          {analisis_ads.big_4_campanas?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {analisis_ads.big_4_campanas.map((c, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: '#333', margin: 0 }}>{c.nombre}</p>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1a3a5c' }}>${c.inversion_mensual_usd}/mes</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>
                    {c.objetivo} · Rendimiento: {c.rendimiento} {c.notas && `· ${c.notas}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          {analisis_ads.recomendacion_ads && (
            <p style={{ fontSize: 13, color: '#1a3a5c', fontStyle: 'italic' }}>
              {analisis_ads.recomendacion_ads}
            </p>
          )}
        </Section>
      )}

      {analisis_ml && (
        <Section title="Marketplace ML">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Preguntas sin respuesta</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: analisis_ml.preguntas_sin_respuesta > 20 ? '#cf1322' : '#1a3a5c', margin: 0 }}>
                {analisis_ml.preguntas_sin_respuesta}
              </p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Sin imágenes</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#d46b08', margin: 0 }}>{analisis_ml.listings_con_imagenes_faltantes}</p>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 2px' }}>Datos incompletos</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#d46b08', margin: 0 }}>{analisis_ml.listings_con_datos_incompletos}</p>
            </div>
          </div>
          {analisis_ml.resumen && (
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>{analisis_ml.resumen}</p>
          )}
          {analisis_ml.problemas?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {analisis_ml.problemas.map((p, i) => {
                const severityColor = p.severidad === 'alta' ? { bg: '#fff1f0', color: '#cf1322', border: '#ffccc7' } : p.severidad === 'media' ? { bg: '#fff7e6', color: '#d46b08', border: '#ffd591' } : { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' };
                return (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <p style={{ fontWeight: 600, fontSize: 12, color: '#333', margin: 0 }}>{p.area}</p>
                      <Badge label={p.severidad} colors={severityColor} />
                    </div>
                    <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>{p.descripcion}</p>
                    <p style={{ fontSize: 12, color: '#1a3a5c', margin: 0, fontStyle: 'italic' }}>{p.accion_sugerida}</p>
                  </div>
                );
              })}
            </div>
          )}
          {analisis_ml.tendencias?.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>Tendencias de mercado</p>
              {analisis_ml.tendencias.map((t, i) => {
                const trendColor = t.tendencia === 'alta' ? '#389e0d' : t.tendencia === 'presión_alta' ? '#cf1322' : t.tendencia === 'baja' ? '#d46b08' : '#555';
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: trendColor }}>{t.tendencia}</span>
                    <span>{t.indicador}: {t.nota}</span>
                  </div>
                );
              })}
            </div>
          )}
          {analisis_ml.recomendacion_ml && (
            <p style={{ fontSize: 13, color: '#1a3a5c', marginTop: 12, fontStyle: 'italic' }}>
              {analisis_ml.recomendacion_ml}
            </p>
          )}
        </Section>
      )}

      {categorias?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a3a5c', marginBottom: 12 }}>
            Evaluación por categoría
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {categorias.map((c, i) => <CategoryBadge key={i} cat={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
