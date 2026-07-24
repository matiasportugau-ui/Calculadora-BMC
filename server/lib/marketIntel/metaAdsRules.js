// Deterministic Meta Ads recommendations (no LLM).
// Source: rules engine — always on for MetaAdsReport.

/**
 * @param {object} report - MetaAdsReport-like object (kpis, campaigns, diagnostics, meta)
 * @returns {Array<{id,priority,action,reason,expected_effect?,source:'rules'}>}
 */
export function buildRulesRecommendations(report) {
  const recs = [];
  const d = report?.diagnostics || {};
  const kpis = report?.kpis || {};
  const campaigns = Array.isArray(report?.campaigns) ? report.campaigns : [];
  const total = Number(d.total_campaigns) || campaigns.length || 0;
  const zombie = Number(d.zombie) || campaigns.filter((c) => c.status === 'ZOMBIE').length || 0;
  const active = Number(d.active) || campaigns.filter((c) => c.status === 'ACTIVE').length || 0;

  if (total > 0 && zombie / total >= 0.5) {
    recs.push({
      id: 'rules-zombie-ratio',
      priority: 'alta',
      action: 'Pausar campañas zombie y no crear más fragmentadas',
      reason: `Ratio zombie ${zombie}/${total} ≥ 50% — ensucia aprendizaje y gestión`,
      expected_effect: 'Cuenta más limpia; mejor señal al algoritmo',
      source: 'rules',
    });
  }

  if (active > 0 && active <= 4 && (kpis.spend || 0) > 0) {
    recs.push({
      id: 'rules-consolidate-asc',
      priority: 'media',
      action: 'Consolidar activas en 1–2 Advantage+ (ASC) con tracking de conversión',
      reason: `Solo ${active} campañas activas con gasto — consolidación reduce fragmentación`,
      expected_effect: 'Gestión más simple y optimización automática de entrega',
      source: 'rules',
    });
  }

  const freq = kpis.frequency;
  if (typeof freq === 'number' && freq >= 3.5) {
    recs.push({
      id: 'rules-frequency',
      priority: 'alta',
      action: 'Rotar creativos o ampliar audiencia (frecuencia alta)',
      reason: `Frecuencia ${freq} ≥ 3.5 — riesgo de fatiga`,
      expected_effect: 'Recuperar CTR/resultados o bajar costo por lead',
      source: 'rules',
    });
  }

  const withSpend = campaigns.filter((c) => (c.spend || 0) > 0 && c.cpl != null);
  if (withSpend.length >= 2 && (kpis.spend || 0) > 0) {
    const sorted = [...withSpend].sort((a, b) => (b.spend || 0) - (a.spend || 0));
    const top = sorted[0];
    const share = top.share_of_spend != null ? top.share_of_spend : ((top.spend / kpis.spend) * 100);
    const better = withSpend.filter((c) => c.id !== top.id && c.cpl != null && c.cpl < top.cpl);
    if (share >= 50 && better.length > 0) {
      recs.push({
        id: 'rules-spend-concentration',
        priority: 'media',
        action: `Revisar presupuesto de "${top.name}" vs campañas con mejor CPL`,
        reason: `Concentra ~${Math.round(share)}% del spend con CPL ${top.cpl} peor que peers`,
        expected_effect: 'Mejor CPL promedio reasignando a creativos/campañas eficientes',
        source: 'rules',
      });
    }
  }

  const freshness = report?.meta?.freshness;
  const source = report?.meta?.source;
  if (freshness === 'snapshot' || source === 'adsIntelligence.json') {
    const auditNote = report?.meta?.notes?.find((n) => /audit|2026|fecha/i.test(n)) || '';
    recs.push({
      id: 'rules-stale-snapshot',
      priority: 'media',
      action: 'Conectar Meta Ads Live (token) o refrescar auditoría',
      reason: `Datos en modo snapshot${auditNote ? ` (${auditNote})` : ''} — no son insights en vivo`,
      expected_effect: 'Decisiones de presupuesto con CPL/series reales',
      source: 'rules',
    });
  }

  if (report?.meta?.freshness === 'demo') {
    recs.push({
      id: 'rules-demo-disclaimer',
      priority: 'baja',
      action: 'Usar Demo solo para UI; cambiar a Snapshot o Live para decisiones de plata',
      reason: 'Fuente fixture (demo) — no es gasto real de la cuenta',
      source: 'rules',
    });
  }

  // De-dupe by id
  const seen = new Set();
  return recs.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
