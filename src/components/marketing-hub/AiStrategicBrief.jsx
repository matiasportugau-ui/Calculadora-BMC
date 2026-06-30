import React, { useCallback, useState } from 'react';
import { downloadPdf } from '../../utils/pdfGenerator.js';

const C = {
  primary: '#1a3a5c',
  surface: '#fafafa',
  border: '#e5e5ea',
  text: '#333',
  textSecondary: '#888',
  success: '#389e0d',
  warning: '#d46b08',
  danger: '#cf1322',
  info: '#003a8c',
  infoBg: '#e6f7ff',
  infoBorder: '#91d5ff',
};

const badgeColors = {
  alto: { bg: '#fff1f0', color: C.danger, border: '#ffccc7' },
  medio: { bg: '#fff7e6', color: C.warning, border: '#ffd591' },
  bajo: { bg: '#f6ffed', color: C.success, border: '#b7eb8f' },
};
const signalColors = {
  positiva: { bg: '#f6ffed', color: C.success, border: '#b7eb8f' },
  negativa: { bg: '#fff1f0', color: C.danger, border: '#ffccc7' },
  neutra: { bg: '#f5f5f7', color: '#666', border: '#e5e5ea' },
};
const priorityColors = {
  alta: { bg: '#fff1f0', color: C.danger, border: '#ffccc7' },
  media: { bg: '#fff7e6', color: C.warning, border: '#ffd591' },
  baja: { bg: '#f6ffed', color: C.success, border: '#b7eb8f' },
};
const categoryColors = {
  fuerte: { bg: '#f6ffed', color: C.success, border: '#b7eb8f' },
  neutral: { bg: '#f5f5f7', color: '#666', border: '#e5e5ea' },
  debíl: { bg: '#fff7e6', color: C.warning, border: '#ffd591' },
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
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: C.primary, marginBottom: 14, paddingBottom: 6, borderBottom: '2px solid #d6e4ff' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 120 }}>
      <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: color || C.primary, margin: 0 }}>{value}</p>
    </div>
  );
}

function OpportunityCard({ opp }) {
  const c = badgeColors[opp.impacto] || badgeColors.medio;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, color: C.text, margin: 0 }}>{opp.producto}</p>
          <p style={{ fontSize: 11, color: C.textSecondary, margin: '2px 0 0' }}>{opp.categoria}</p>
        </div>
        <Badge label={opp.impacto} colors={c} />
      </div>
      <p style={{ fontSize: 12, color: '#555', margin: '0 0 8px', lineHeight: 1.5 }}>{opp.descripcion}</p>
      <p style={{ fontSize: 12, color: C.primary, margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>{opp.accion_sugerida}</p>
    </div>
  );
}

function SignalCard({ sig }) {
  const c = signalColors[sig.tipo] || signalColors.neutra;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <p style={{ fontWeight: 600, fontSize: 12, color: C.text, margin: 0 }}>{sig.titulo}</p>
        <Badge label={sig.tipo} colors={c} />
      </div>
      <p style={{ fontSize: 12, color: '#555', margin: '0 0 6px', lineHeight: 1.5 }}>{sig.descripcion}</p>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.textSecondary }}>
        {sig.producto_relacionado && <span>Producto: {sig.producto_relacionado}</span>}
        {sig.competidor_relacionado && <span>Competidor: {sig.competidor_relacionado}</span>}
      </div>
    </div>
  );
}

function RecommendationCard({ rec }) {
  const c = priorityColors[rec.prioridad] || priorityColors.media;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 14, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <p style={{ fontWeight: 600, fontSize: 12, color: C.text, margin: 0 }}>{rec.accion}</p>
        <Badge label={rec.prioridad} colors={c} />
      </div>
      <p style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>Área: {rec.area}</p>
      <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.5 }}>{rec.detalle}</p>
    </div>
  );
}

function CategoryBadge({ cat }) {
  const c = categoryColors[cat.evaluacion] || categoryColors.sin_datos;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 14, flex: '1 1 180px', minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <p style={{ fontWeight: 600, fontSize: 12, color: C.text, margin: 0 }}>{cat.nombre}</p>
        <Badge label={cat.evaluacion} colors={c} />
      </div>
      <div style={{ fontSize: 11, color: C.textSecondary, display: 'flex', gap: 12 }}>
        <span>Competidores: {cat.competidores_activos}</span>
      </div>
      {cat.observacion && <p style={{ fontSize: 11, color: '#555', margin: '6px 0 0', lineHeight: 1.4 }}>{cat.observacion}</p>}
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
      <p style={{ fontWeight: 600, color: C.danger, marginBottom: 8 }}>Error al generar brief</p>
      <p style={{ fontSize: 13, color: '#820014', marginBottom: 16 }}>{message}</p>
      <button onClick={onRetry} style={{ fontSize: 13, padding: '8px 16px', background: C.danger, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        Reintentar
      </button>
    </div>
  );
}

function buildPdfHtml(brief) {
  const { resumen_ejecutivo, oportunidades, senalas, recomendaciones, categorias, analisis_precios, analisis_ads, analisis_ml } = brief;
  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const cards = (items, fields) => items?.map(i => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:8px;padding:12px;margin-bottom:8px;page-break-inside:avoid;">
    ${fields.map(f => {
      if (f === '__badge') return '';
      const val = i[f.key];
      if (!val) return '';
      if (f.bold) return `<p style="font-weight:600;font-size:13px;color:#1a3a5c;margin:0 0 4px">${esc(val)}</p>`;
      if (f.label) return `<p style="font-size:11px;color:#888;margin:0 0 2px"><strong>${esc(f.label)}:</strong> ${esc(val)}</p>`;
      return `<p style="font-size:12px;color:#555;margin:0;line-height:1.5">${esc(val)}</p>`;
    }).join('')}
  </div>`).join('') || '';

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Brief Estratégico BMC</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif; color: #333; font-size: 11pt; line-height: 1.5; background: #fff; }
  h1 { font-size: 20pt; color: #1a3a5c; margin: 0 0 4px; }
  h2 { font-size: 14pt; color: #1a3a5c; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 2px solid #d6e4ff; }
  h3 { font-size: 12pt; color: #1a3a5c; margin: 14px 0 6px; }
  .summary { background: #e6f7ff; border: 1px solid #91d5ff; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 8px 0 14px; page-break-inside: avoid; }
  th { background: #f0f5ff; padding: 7px 10px; text-align: left; border-bottom: 2px solid #d6e4ff; color: #1a3a5c; }
  td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 14px; }
  .kpi { flex: 1; border: 1px solid #e5e5ea; border-radius: 8px; padding: 10px 14px; }
  .kpi-label { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.3px; margin: 0 0 2px; }
  .kpi-value { font-size: 22pt; font-weight: 700; color: #1a3a5c; margin: 0; }
  .meta { font-size: 9pt; color: #999; margin-bottom: 14px; }
  .badge-pos { display:inline-block; padding:1px 7px; border-radius:8px; font-size:9pt; font-weight:600; background:#f6ffed; color:#389e0d; border:1px solid #b7eb8f; }
  .badge-neg { display:inline-block; padding:1px 7px; border-radius:8px; font-size:9pt; font-weight:600; background:#fff1f0; color:#cf1322; border:1px solid #ffccc7; }
  .footer { margin-top: 24px; font-size: 9pt; color: #999; text-align: center; border-top: 1px solid #e5e5ea; padding-top: 12px; }
</style></head><body>
<h1>Brief Estratégico — BMC Uruguay</h1>
<p class="meta">Generado el ${new Date().toLocaleDateString('es-UY', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })} vía ${brief.provider || 'AI'}</p>
${resumen_ejecutivo ? `<div class="summary">${esc(resumen_ejecutivo)}</div>` : ''}
<div class="kpi-row">
  <div class="kpi"><p class="kpi-label">Oportunidades</p><p class="kpi-value">${oportunidades?.length || 0}</p></div>
  <div class="kpi"><p class="kpi-label">Señales</p><p class="kpi-value">${senalas?.length || 0}</p></div>
  <div class="kpi"><p class="kpi-label">Recomendaciones</p><p class="kpi-value">${recomendaciones?.length || 0}</p></div>
  <div class="kpi"><p class="kpi-label">Categorías</p><p class="kpi-value">${categorias?.length || 0}</p></div>
</div>`;

  if (oportunidades?.length) {
    html += `<h2>Oportunidades</h2>${oportunidades.map(o => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:8px;padding:12px;margin-bottom:8px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div><p style="font-weight:600;font-size:13px;color:#1a3a5c;margin:0">${esc(o.producto)}</p>
        <p style="font-size:11px;color:#888;margin:2px 0 0">${esc(o.categoria)}</p></div>
        <span class="${o.impacto === 'alto' ? 'badge-neg' : 'badge-pos'}">${esc(o.impacto)}</span>
      </div>
      <p style="font-size:12px;color:#555;margin:0 0 6px;line-height:1.5">${esc(o.descripcion)}</p>
      <p style="font-size:12px;color:#1a3a5c;margin:0;font-style:italic">${esc(o.accion_sugerida)}</p>
    </div>`).join('')}`;
  }

  if (senalas?.length) {
    html += `<h2>Señales de Mercado</h2>${senalas.map(s => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:8px;padding:12px;margin-bottom:8px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <p style="font-weight:600;font-size:12px;color:#333;margin:0">${esc(s.titulo)}</p>
        <span class="${s.tipo === 'negativa' ? 'badge-neg' : 'badge-pos'}">${esc(s.tipo)}</span>
      </div>
      <p style="font-size:12px;color:#555;margin:0;line-height:1.5">${esc(s.descripcion)}</p>
      ${s.producto_relacionado ? `<p style="font-size:11px;color:#888;margin:4px 0 0">Producto: ${esc(s.producto_relacionado)}</p>` : ''}
    </div>`).join('')}`;
  }

  if (recomendaciones?.length) {
    html += `<h2>Recomendaciones</h2>${recomendaciones.map(r => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:8px;padding:12px;margin-bottom:8px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <p style="font-weight:600;font-size:12px;color:#333;margin:0">${esc(r.accion)}</p>
        <span class="${r.prioridad === 'alta' ? 'badge-neg' : r.prioridad === 'media' ? 'badge-pos' : 'badge-pos'}">${esc(r.prioridad)}</span>
      </div>
      <p style="font-size:11px;color:#888;margin:0 0 4px">Área: ${esc(r.area)}</p>
      <p style="font-size:12px;color:#555;margin:0;line-height:1.5">${esc(r.detalle)}</p>
    </div>`).join('')}`;
  }

  if (analisis_precios?.brechas?.length) {
    html += `<h2>Análisis de Precios</h2>
      <p style="font-size:11pt;color:#555;margin:0 0 8px">${esc(analisis_precios.resumen)}</p>
      <table><thead><tr>
        <th>Producto</th><th style="text-align:right">BMC USD/m²</th><th style="text-align:right">Mercado USD/m²</th><th style="text-align:right">Diferencia</th><th>Interpretación</th>
      </tr></thead><tbody>
      ${analisis_precios.brechas.map(b => `<tr>
        <td style="font-weight:600">${esc(b.producto)}</td>
        <td style="text-align:right">$${b.precio_bmc_usd_m2?.toFixed(2)}</td>
        <td style="text-align:right">$${b.precio_referencia_mercado_usd_m2?.toFixed(2)}</td>
        <td style="text-align:right;color:${b.diferencia_porcentaje > 0 ? '#cf1322' : '#389e0d'}">${b.diferencia_porcentaje > 0 ? '+' : ''}${b.diferencia_porcentaje?.toFixed(1)}%</td>
        <td style="font-size:10pt">${esc(b.interpretacion)}</td>
      </tr>`).join('')}
      </tbody></table>
      ${analisis_precios.recomendacion_precios ? `<p style="font-size:11pt;color:#1a3a5c;font-style:italic">${esc(analisis_precios.recomendacion_precios)}</p>` : ''}`;
  }

  if (analisis_ads) {
    html += `<h2>Meta Ads</h2>
      <div class="kpi-row">
        <div class="kpi"><p class="kpi-label">Total</p><p class="kpi-value" style="color:#1a3a5c">${analisis_ads.total_campanas || 0}</p></div>
        <div class="kpi"><p class="kpi-label">Activas</p><p class="kpi-value" style="color:#389e0d">${analisis_ads.campanas_activas || 0}</p></div>
        <div class="kpi"><p class="kpi-label">Zombies</p><p class="kpi-value" style="color:#cf1322">${analisis_ads.campanas_zombie || 0}</p></div>
      </div>
      <p style="font-size:11pt;color:#555;margin:0 0 8px">${esc(analisis_ads.resumen)}</p>
      ${analisis_ads.diagnostico ? `<div style="background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:10px;margin-bottom:10px">
        <p style="font-weight:600;font-size:11pt;color:#d46b08;margin:0 0 4px">Diagnóstico</p>
        <p style="font-size:11pt;color:#555;margin:0">${esc(analisis_ads.diagnostico)}</p>
      </div>` : ''}
      ${analisis_ads.big_4_campanas?.length ? `<h3>Campañas principales</h3>${analisis_ads.big_4_campanas.map(c => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:8px;padding:10px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between"><p style="font-weight:600;font-size:12px;color:#333;margin:0">${esc(c.nombre)}</p><span style="font-weight:700;color:#1a3a5c">$${c.inversion_mensual_usd}/mes</span></div>
        <p style="font-size:11px;color:#888;margin:4px 0 0">${esc(c.objetivo)} · Rendimiento: ${esc(c.rendimiento)}</p>
      </div>`).join('')}` : ''}
      ${analisis_ads.recomendacion_ads ? `<p style="font-size:11pt;color:#1a3a5c;font-style:italic">${esc(analisis_ads.recomendacion_ads)}</p>` : ''}`;
  }

  if (analisis_ml) {
    html += `<h2>MercadoLibre Uruguay</h2>
      <div class="kpi-row">
        <div class="kpi"><p class="kpi-label">Preguntas sin respuesta</p><p class="kpi-value" style="color:${analisis_ml.preguntas_sin_respuesta > 20 ? '#cf1322' : '#1a3a5c'}">${analisis_ml.preguntas_sin_respuesta || 0}</p></div>
        <div class="kpi"><p class="kpi-label">Sin imágenes</p><p class="kpi-value" style="color:#d46b08">${analisis_ml.listings_con_imagenes_faltantes || 0}</p></div>
        <div class="kpi"><p class="kpi-label">Datos incompletos</p><p class="kpi-value" style="color:#d46b08">${analisis_ml.listings_con_datos_incompletos || 0}</p></div>
      </div>
      <p style="font-size:11pt;color:#555;margin:0 0 8px">${esc(analisis_ml.resumen)}</p>
      ${analisis_ml.problemas?.length ? `<h3>Problemas identificados</h3>${analisis_ml.problemas.map(p => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:8px;padding:10px;margin-bottom:6px">
        <p style="font-weight:600;font-size:12px;color:#333;margin:0">${esc(p.area)} — ${esc(p.severidad)}</p>
        <p style="font-size:12px;color:#555;margin:4px 0">${esc(p.descripcion)}</p>
        <p style="font-size:12px;color:#1a3a5c;font-style:italic">${esc(p.accion_sugerida)}</p>
      </div>`).join('')}` : ''}
      ${analisis_ml.tendencias?.length ? `<h3>Tendencias</h3>${analisis_ml.tendencias.map(t => `<p style="font-size:12px;color:#555;margin:2px 0"><strong>${esc(t.tendencia)}</strong> — ${esc(t.indicador)}: ${esc(t.nota)}</p>`).join('')}` : ''}
      ${analisis_ml.recomendacion_ml ? `<p style="font-size:11pt;color:#1a3a5c;font-style:italic;margin-top:10px">${esc(analisis_ml.recomendacion_ml)}</p>` : ''}`;
  }

  if (categorias?.length) {
    html += `<h2>Evaluación por Categoría</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${categorias.map(c => `<div style="border:1px solid #e5e5ea;border-radius:8px;padding:10px;flex:1 1 160px;min-width:140px;page-break-inside:avoid">
        <p style="font-weight:600;font-size:12px;color:#333;margin:0 0 4px">${esc(c.nombre)}</p>
        <p style="font-size:11px;color:#888;margin:0 0 4px">${esc(c.evaluacion)} · ${c.competidores_activos} competidores</p>
        <p style="font-size:11px;color:#555;margin:0">${esc(c.observacion)}</p>
      </div>`).join('')}</div>`;
  }

  html += `<div class="footer">BMC Uruguay — Panelin Calculadora — Brief Estratégico generado automáticamente</div></body></html>`;
  return html;
}

export default function AiStrategicBrief({ brief, loading, error, onRetry }) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!brief) return;
    setPdfLoading(true);
    try {
      const html = buildPdfHtml(brief);
      await downloadPdf(html, `brief-estrategico-bmc-${Date.now()}.pdf`);
    } catch (err) {
      console.error('[AiStrategicBrief] PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [brief]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!brief) return null;

  const { resumen_ejecutivo, oportunidades, senalas, recomendaciones, categorias, analisis_precios, analisis_ads, analisis_ml } = brief;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.primary, margin: 0 }}>
            Brief Estratégico
          </h2>
          <p style={{ fontSize: 12, color: C.textSecondary, margin: '2px 0 0' }}>
            Generado vía {brief.provider || 'AI'} · {new Date().toLocaleDateString('es-UY', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}
          </p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          style={{
            fontSize: 12, padding: '8px 16px',
            background: pdfLoading ? '#d9d9d9' : C.primary,
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: pdfLoading ? 'not-allowed' : 'pointer',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {pdfLoading ? 'Generando PDF…' : 'Descargar PDF'}
        </button>
      </div>

      {resumen_ejecutivo && (
        <div style={{ background: C.infoBg, border: `1px solid ${C.infoBorder}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.info, margin: '0 0 4px' }}>Resumen Ejecutivo</p>
          <p style={{ fontSize: 14, color: C.info, margin: 0, lineHeight: 1.6 }}>{resumen_ejecutivo}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {oportunidades && <KpiCard label="Oportunidades" value={oportunidades.length} color={C.success} />}
        {senalas && <KpiCard label="Señales" value={senalas.length} color={C.warning} />}
        {recomendaciones && <KpiCard label="Recomendaciones" value={recomendaciones.length} color={C.primary} />}
        {categorias && <KpiCard label="Categorías" value={categorias.length} color={C.info} />}
        {analisis_precios?.brechas && <KpiCard label="Brechas precio" value={analisis_precios.brechas.length} color={C.primary} />}
        {analisis_ads && (
          <KpiCard
            label="Ads zombies"
            value={analisis_ads.campanas_zombie || 0}
            color={analisis_ads.campanas_zombie > 10 ? C.danger : C.success}
          />
        )}
        {analisis_ml && (
          <KpiCard
            label="Preguntas ML sin respuesta"
            value={analisis_ml.preguntas_sin_respuesta || 0}
            color={analisis_ml.preguntas_sin_respuesta > 20 ? C.danger : C.warning}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {oportunidades?.length > 0 && (
          <Section title="Oportunidades">
            {oportunidades.map((o, i) => <OpportunityCard key={i} opp={o} />)}
          </Section>
        )}

        {senalas?.length > 0 && (
          <Section title="Señales de mercado">
            {senalas.map((s, i) => <SignalCard key={i} sig={s} />)}
          </Section>
        )}

        {recomendaciones?.length > 0 && (
          <Section title="Recomendaciones">
            {recomendaciones.map((r, i) => <RecommendationCard key={i} rec={r} />)}
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
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #d6e4ff', color: C.primary }}>Producto</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #d6e4ff', color: C.primary }}>BMC USD/m²</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #d6e4ff', color: C.primary }}>Mercado USD/m²</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid #d6e4ff', color: C.primary }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {analisis_precios.brechas.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: C.text }}>{b.producto}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${b.precio_bmc_usd_m2?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>${b.precio_referencia_mercado_usd_m2?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: b.diferencia_porcentaje > 0 ? C.danger : C.success }}>
                        {b.diferencia_porcentaje > 0 ? '+' : ''}{b.diferencia_porcentaje?.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {analisis_precios.recomendacion_precios && (
            <p style={{ fontSize: 13, color: C.primary, marginTop: 12, fontStyle: 'italic' }}>
              {analisis_precios.recomendacion_precios}
            </p>
          )}
        </Section>
      )}

      {analisis_ads && (
        <Section title="Análisis de Meta Ads">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 2px' }}>Total campañas</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.primary, margin: 0 }}>{analisis_ads.total_campanas}</p>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 2px' }}>Activas</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.success, margin: 0 }}>{analisis_ads.campanas_activas}</p>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 2px' }}>Zombies</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.danger, margin: 0 }}>{analisis_ads.campanas_zombie}</p>
            </div>
          </div>
          {analisis_ads.resumen && (
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>{analisis_ads.resumen}</p>
          )}
          {analisis_ads.diagnostico && (
            <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.warning, margin: '0 0 4px' }}>Diagnóstico</p>
              <p style={{ fontSize: 12, color: '#555', margin: 0 }}>{analisis_ads.diagnostico}</p>
            </div>
          )}
          {analisis_ads.big_4_campanas?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {analisis_ads.big_4_campanas.map((c, i) => (
                <div key={i} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontWeight: 600, fontSize: 12, color: C.text, margin: 0 }}>{c.nombre}</p>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.primary }}>${c.inversion_mensual_usd}/mes</span>
                  </div>
                  <p style={{ fontSize: 11, color: C.textSecondary, margin: '4px 0 0' }}>
                    {c.objetivo} · Rendimiento: {c.rendimiento} {c.notas && `· ${c.notas}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          {analisis_ads.recomendacion_ads && (
            <p style={{ fontSize: 13, color: C.primary, fontStyle: 'italic' }}>
              {analisis_ads.recomendacion_ads}
            </p>
          )}
        </Section>
      )}

      {analisis_ml && (
        <Section title="Marketplace ML">
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 2px' }}>Preguntas sin respuesta</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: analisis_ml.preguntas_sin_respuesta > 20 ? C.danger : C.primary, margin: 0 }}>
                {analisis_ml.preguntas_sin_respuesta}
              </p>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 2px' }}>Sin imágenes</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.warning, margin: 0 }}>{analisis_ml.listings_con_imagenes_faltantes}</p>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
              <p style={{ fontSize: 11, color: C.textSecondary, margin: '0 0 2px' }}>Datos incompletos</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.warning, margin: 0 }}>{analisis_ml.listings_con_datos_incompletos}</p>
            </div>
          </div>
          {analisis_ml.resumen && (
            <p style={{ fontSize: 13, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>{analisis_ml.resumen}</p>
          )}
          {analisis_ml.problemas?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {analisis_ml.problemas.map((p, i) => {
                const severityColor = p.severidad === 'alta' ? { bg: '#fff1f0', color: C.danger, border: '#ffccc7' } : p.severidad === 'media' ? { bg: '#fff7e6', color: C.warning, border: '#ffd591' } : { bg: '#f6ffed', color: C.success, border: '#b7eb8f' };
                return (
                  <div key={i} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <p style={{ fontWeight: 600, fontSize: 12, color: C.text, margin: 0 }}>{p.area}</p>
                      <Badge label={p.severidad} colors={severityColor} />
                    </div>
                    <p style={{ fontSize: 12, color: '#555', margin: '4px 0', lineHeight: 1.5 }}>{p.descripcion}</p>
                    <p style={{ fontSize: 12, color: C.primary, margin: 0, fontStyle: 'italic' }}>{p.accion_sugerida}</p>
                  </div>
                );
              })}
            </div>
          )}
          {analisis_ml.tendencias?.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>Tendencias de mercado</p>
              {analisis_ml.tendencias.map((t, i) => {
                const trendColor = t.tendencia === 'alta' ? C.success : t.tendencia === 'presión_alta' ? C.danger : t.tendencia === 'baja' ? C.warning : '#555';
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555', marginBottom: 4, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: trendColor, textTransform: 'uppercase' }}>{t.tendencia}</span>
                    <span>{t.indicador}: {t.nota}</span>
                  </div>
                );
              })}
            </div>
          )}
          {analisis_ml.recomendacion_ml && (
            <p style={{ fontSize: 13, color: C.primary, marginTop: 12, fontStyle: 'italic' }}>
              {analisis_ml.recomendacion_ml}
            </p>
          )}
        </Section>
      )}

      {categorias?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.primary, marginBottom: 14, paddingBottom: 6, borderBottom: '2px solid #d6e4ff' }}>
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
