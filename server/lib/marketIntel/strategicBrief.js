// Module: strategic-brief | Owner: bmc-dev | Created: 2026-06-29
// Generates AI-powered strategic analysis of product intelligence data.

import pino from 'pino';
import { callAgentOnce } from '../agentCore.js';
import {
  getEtlSummary,
  getBaselinePrices,
  getCompetitorMap,
  getAdsIntelligence,
  getMlPulse,
  PRODUCT_CATEGORIES,
} from './productIntelligence.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const STRATEGIC_SYSTEM_PROMPT = `Eres el estratega de producto de BMC Uruguay, una empresa de paneles aislantes para construcción (techos y paredes). Tu rol es analizar datos de inteligencia de mercado y generar un brief estratégico ejecutivo.

## FORMATO DE RESPUESTA
Debes responder ÚNICAMENTE con un JSON válido, sin markdown ni texto adicional. Usa esta estructura exacta:

{
  "oportunidades": [
    {
      "producto": "nombre del producto",
      "categoria": "categoría",
      "tipo": "oportunidad",
      "descripcion": "explicación breve",
      "impacto": "alto|medio|bajo",
      "accion_sugerida": "qué hacer"
    }
  ],
  "senalas": [
    {
      "titulo": "título de la señal",
      "tipo": "positiva|negativa|neutra",
      "descripcion": "explicación",
      "producto_relacionado": "producto o null",
      "competidor_relacionado": "competidor o null"
    }
  ],
  "recomendaciones": [
    {
      "area": "pricing|producto|competencia|estrategia|ads|ml",
      "accion": "qué hacer",
      "prioridad": "alta|media|baja",
      "detalle": "por qué y cómo"
    }
  ],
  "resumen_ejecutivo": "Un párrafo de 2-3 oraciones con el panorama general que integre precios, ads y ML."
}

## REGLAS ESTRICTAS
- NO incluyas texto fuera del JSON. La respuesta debe comenzar exactamente con '{' y terminar exactamente con '}'.
- NO uses markdown, NO uses bloques de código, NO uses texto introductorio ni conclusivo.
- resumen_ejecutivo debe ser una cadena de texto de 2-3 oraciones cortas. NO pongas JSON dentro de este campo.
- Cada array (oportunidades, senalas, recomendaciones) debe tener AL MENOS 2 elementos.

## PRINCIPIOS DE ANÁLISIS
1. Identifica productos con brecha de precio favorable (oportunidad de margen).
2. Señala categorías donde BMC tiene poca o ninguna competencia (liderazgo).
3. Cruza los perfiles de competidores (tipo, tier, threat_score, opportunity_score) con las categorías de producto para identificar patrones.
4. Genera al menos 2-3 ítems en oportunidades, señales y recomendaciones usando los datos disponibles. Si hay poca data, sé creativo pero fundado.`;

function formatCompetitorData(competitors) {
  if (!competitors || competitors.length === 0) return 'No hay datos de competidores.';
  return competitors.map(c => {
    const meta = c.metadata || {};
    const productos = Array.isArray(meta.productos) ? meta.productos.join(', ') : '';
    return `- ${c.name} (${c.domain}) | tipo: ${c.type} | tier: ${c.tier} | threat: ${c.threat_score}/5 | opp: ${c.opportunity_score}/5${productos ? ` | productos: ${productos}` : ''}${c.notes ? ` | notas: ${c.notes}` : ''}`;
  }).join('\n');
}

function formatEtlData(summary) {
  const parts = [];
  if (summary.last_etl_run) {
    const e = summary.last_etl_run;
    parts.push(`Último ETL: ${e.status} (${e.competitors_succeeded}/${e.competitors_attempted} competidores, ${e.finished_at})`);
  }
  if (summary.alert_counts) {
    const a = summary.alert_counts;
    parts.push(`Alertas: ${a.critical} críticas, ${a.warning} warnings, ${a.info} info`);
  }
  return parts.join('\n') || 'Sin datos ETL';
}

function formatBaselinePrices(prices) {
  if (!prices || prices.length === 0) return 'No hay datos de precios base.';
  return prices.map(p =>
    `- ${p.producto} ${p.espesor_mm}mm (${p.nucleo}) | ${p.familia} | USD ${p.precio_publico_usd_m2 ?? 'cotización'}/m²`
  ).join('\n');
}

function formatCompetitorMap(map) {
  if (!map?.product_family_mapping) return 'No hay mapa de competidores.';
  return map.product_family_mapping.map(m =>
    `- ${m.competidor} (T${m.tier} ${m.type}) | principal: ${m.familia_principal}${m.familia_secundaria ? ` | secundaria: ${m.familia_secundaria}` : ''}`
  ).join('\n');
}

function formatAdsIntel(ads) {
  if (!ads) return 'No hay datos de ads.';
  const big4 = ads.big_4_campanas?.map(c =>
    `- ${c.nombre}: $${c.inversion_mensual_usd}/mes (${c.objetivo}, rendimiento ${c.rendimiento})`
  ).join('\n') || 'Sin datos';
  return [
    `Total campañas: ${ads.total_campanas}`,
    `Campanas activas: ${ads.campanas_activas}`,
    `Zombies: ${ads.campanas_zombie}`,
    `Inversión total: $${ads.inversion_total_mensual_usd}/mes`,
    `Diagnóstico: ${ads.diagnostico}`,
    `Recomendación ASC: ${ads.presupuesto_recomendado_asc_usd}`,
    `\nBig 4 campañas:\n${big4}`,
    `\nAd copy angles disponibles: ${ads.ad_copy_angles?.map(a => a.nombre).join(', ') || 'ninguno'}`,
  ].join('\n');
}

function formatMlPulse(ml) {
  if (!ml) return 'No hay datos de ML.';
  const probs = ml.problemas_identificados?.map(p =>
    `- ${p.area} (${p.severidad}): ${p.descripcion} → ${p.accion_sugerida}`
  ).join('\n') || 'Sin problemas identificados';
  const tendencias = ml.tendencias_mercado?.map(t =>
    `- ${t.indicador}: ${t.tendencia} — ${t.nota}`
  ).join('\n') || 'Sin tendencias';
  return [
    `Preguntas sin respuesta: ${ml.metricas?.preguntas_sin_respuesta || 'N/A'}`,
    `Tasa respuesta: ${ml.metricas?.tasa_respuesta || 'N/A'}`,
    `Listings sin imágenes: ${ml.metricas?.listings_con_imagenes_faltantes || 'N/A'}`,
    `Listings datos incompletos: ${ml.metricas?.listings_con_datos_incompletos || 'N/A'}`,
    `\nProblemas:\n${probs}`,
    `\nTendencias:\n${tendencias}`,
  ].join('\n');
}

export async function generateStrategicBrief() {
  const summary = await getEtlSummary();
  const baselinePrices = getBaselinePrices();
  const competitorMap = getCompetitorMap();
  const adsIntel = getAdsIntelligence();
  const mlPulse = getMlPulse();

  const categoriesInfo = PRODUCT_CATEGORIES.map(c =>
    `- ${c.label} (id: ${c.id})`
  ).join('\n');

  const competitorBlock = formatCompetitorData(summary.competitors);
  const etlBlock = formatEtlData(summary);

  const userContent = `## Datos de competidores (desde ETL)
${competitorBlock}

## Estado ETL
${etlBlock}

## Categorías de producto
${categoriesInfo}

## Productos de BMC
BMC Uruguay vende paneles aislantes para techos (ISODEC EPS/PIR, ISOROOF 3G/FOIL/COLONIAL/PLUS) y paredes (ISOPANEL EPS, ISOWALL PIR, ISOFRIG PIR), además de perfiles, fijaciones y selladores.

## Precios base BMC (catálogo público)
${formatBaselinePrices(baselinePrices)}

## Mapa de competidores y familias de producto
Información offline de los 31 competidores conocidos, su tier, tipo y qué familias de producto cubren:
${formatCompetitorMap(competitorMap)}

## Inteligencia de Meta Ads
${formatAdsIntel(adsIntel)}

## Pulso MercadoLibre Uruguay
${formatMlPulse(mlPulse)}

Genera el brief estratégico en formato JSON con las secciones oportunidades, senalas, recomendaciones y resumen_ejecutivo. Usa los datos proporcionados para generar análisis concretos y accionables.`;

  try {
    const result = await callAgentOnce(
      [
        { role: 'user', content: userContent },
      ],
      { channel: 'chat', systemPrompt: STRATEGIC_SYSTEM_PROMPT, override: { maxTokens: 8192 } }
    );

    const raw = result.text;
    log.info({ raw_preview: raw.slice(0, 2000), provider: result.provider }, 'AI raw response');

    let brief;
    const parseJson = (text) => {
      const trimmed = text.trim();
      const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = codeBlock ? codeBlock[1].trim() : trimmed;
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) return JSON.parse(objMatch[0]);
      throw new Error('No JSON object found');
    };
    try {
      brief = parseJson(raw);
    } catch (firstErr) {
      log.warn({ err: firstErr.message, raw: raw.slice(0, 500) }, 'first JSON parse failed, trying fallback');
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          brief = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Fallback also failed');
        }
      } catch (secondErr) {
        log.error({ err: secondErr.message, raw: raw.slice(0, 1000) }, 'all JSON parse strategies failed');
        brief = { resumen_ejecutivo: raw, oportunidades: [], senalas: [], recomendaciones: [], categorias: [] };
      }
    }

    extractNestedJson(brief);
    brief.analisis_precios = buildAnalisisPrecios(baselinePrices, competitorMap);
    brief.analisis_ads = buildAnalisisAds(adsIntel);
    brief.analisis_ml = buildAnalisisMl(mlPulse);
    brief.categorias = buildCategorias(summary.competitors);
    if (typeof brief.resumen_ejecutivo !== 'string' || !brief.resumen_ejecutivo.trim()) {
      const parts = [];
      if (Array.isArray(brief.oportunidades) && brief.oportunidades.length) parts.push(`${brief.oportunidades.length} oportunidades`);
      if (Array.isArray(brief.recomendaciones) && brief.recomendaciones.length) parts.push(`${brief.recomendaciones.length} recomendaciones`);
      if (Array.isArray(brief.senalas) && brief.senalas.length) parts.push(`${brief.senalas.length} señales`);
      if (brief.analisis_precios?.brechas?.length) parts.push(`${brief.analisis_precios.brechas.length} brechas de precio`);
      brief.resumen_ejecutivo = parts.length
        ? `Análisis generado: ${parts.join(', ')}. Ver secciones detalladas abajo.`
        : 'Brief estratégico generado con análisis de mercado.';
    }

    return {
      brief,
      provider: result.provider,
      model: result.model || null,
      latencyMs: result.latencyMs || null,
      generated_at: new Date().toISOString(),
      data_freshness: {
        etl: summary.last_etl_run?.finished_at || null,
        competitors_count: summary.competitors?.length || 0,
      },
    };
  } catch (err) {
    log.error({ err }, 'generateStrategicBrief failed');
    return {
      brief: null,
      error: err.message,
      generated_at: new Date().toISOString(),
      data_freshness: {
        etl: summary.last_etl_run?.finished_at || null,
        competitors_count: summary.competitors?.length || 0,
      },
    };
  }
}

function repairTruncatedJson(str) {
  let r = str.trim();
  const hasColonAfterLastQuote = /:\s*"[^"]*$/.test(r);
  if (hasColonAfterLastQuote) r += '"';
  r = r.replace(/,(\s*[}\]])/g, '$1');
  const chars = r.split('');
  const stack = [];
  let inStr = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '"' && (i === 0 || chars[i - 1] !== '\\')) inStr = !inStr;
    if (!inStr) {
      if (c === '{' || c === '[') stack.push(c);
      if (c === '}' && stack.length && stack[stack.length - 1] === '{') stack.pop();
      if (c === ']' && stack.length && stack[stack.length - 1] === '[') stack.pop();
    }
  }
  while (stack.length) {
    const open = stack.pop();
    r += open === '{' ? '}' : ']';
  }
  try { return JSON.parse(r); } catch { return null; }
}

const TIER_MULTIPLIERS = { 1: 1.3, 2: 1.05, 3: 0.95, 4: 0.85, 5: 0.7 };

function buildAnalisisPrecios(prices, compMap) {
  const families = compMap?.product_family_mapping || [];
  const brechas = [];
  for (const p of prices || []) {
    const bmcPrice = p.precio_publico_usd_m2;
    if (bmcPrice == null) continue;
    const familiaKey = p.familia;
    const relevantComp = families.filter(f =>
      f.familia_principal?.includes(familiaKey) || f.familia_secundaria?.includes(familiaKey)
    );
    const tiers = relevantComp.map(c => c.tier).filter(Boolean);
    const mults = tiers.map(t => TIER_MULTIPLIERS[t] || 1);
    const avgMult = mults.length ? mults.reduce((a, b) => a + b, 0) / mults.length : 1;
    const refPrice = +(bmcPrice * avgMult).toFixed(2);
    const diff = +(bmcPrice - refPrice).toFixed(2);
    const diffPct = +((diff / refPrice) * 100).toFixed(1);
    let interp = '';
    if (diff > 0) {
      interp = `BMC está ${diffPct}% por encima del precio de referencia. Riesgo de pérdida de volumen frente a alternativas más económicas de competidores de perfil similar.`;
    } else if (diff < 0) {
      interp = `BMC está ${Math.abs(diffPct)}% por debajo del precio de referencia. Oportunidad de incrementar margen sin perder competitividad.`;
    } else {
      interp = 'BMC está alineado con el precio de referencia. Competir por servicio y calidad, no por precio.';
    }
    brechas.push({
      producto: p.producto,
      precio_bmc_usd_m2: bmcPrice,
      precio_referencia_mercado_usd_m2: refPrice,
      diferencia_usd_m2: diff,
      diferencia_porcentaje: diffPct,
      interpretacion: interp,
    });
  }
  return {
    resumen: brechas.length
      ? `Se analizaron ${brechas.length} productos de BMC. ${brechas.filter(b => b.diferencia_usd_m2 < 0).length} oportunidades de margen, ${brechas.filter(b => b.diferencia_usd_m2 > 0).length} con riesgo de volumen.`
      : 'No hay suficientes datos de precios para generar análisis.',
    brechas,
    recomendacion_precios: brechas.length
      ? 'Revisar productos con brecha positiva (BMC por encima del mercado) para evitar pérdida de volumen. Aprovechar brechas negativas para ajustar márgenes gradualmente.'
      : 'Sin recomendación disponible por falta de datos.',
  };
}

function buildAnalisisAds(ads) {
  if (!ads) return null;
  return {
    resumen: `BMC tiene ${ads.total_campanas || 0} campañas en Meta Ads (${ads.campanas_activas || 0} activas, ${ads.campanas_zombie || 0} zombies). Inversión mensual total: $${ads.inversion_total_mensual_usd || 0}.`,
    big_4_campanas: (ads.big_4_campanas || []).map(c => ({
      nombre: c.nombre,
      inversion_mensual_usd: c.inversion_mensual_usd,
      objetivo: c.objetivo,
      rendimiento: c.rendimiento,
      notas: c.notas || '',
    })),
    total_campanas: ads.total_campanas || 0,
    campanas_activas: ads.campanas_activas || 0,
    campanas_zombie: ads.campanas_zombie || 0,
    diagnostico: ads.diagnostico || 'Sin diagnóstico disponible.',
    recomendacion_ads: ads.recomendacion_asc
      ? `Presupuesto recomendado ASC: $${ads.presupuesto_recomendado_asc_usd}/mes. ${ads.recomendacion_asc}`
      : 'Sin recomendación ASC disponible.',
  };
}

function buildAnalisisMl(ml) {
  if (!ml) return null;
  const m = ml.metricas || {};
  return {
    resumen: `BMC en MercadoLibre Uruguay: ${m.preguntas_sin_respuesta || 0} preguntas sin respuesta, ${m.listings_con_imagenes_faltantes || 0} listings sin imágenes, ${m.listings_con_datos_incompletos || 0} listings con datos incompletos.`,
    preguntas_sin_respuesta: m.preguntas_sin_respuesta || 0,
    listings_con_imagenes_faltantes: m.listings_con_imagenes_faltantes || 0,
    listings_con_datos_incompletos: m.listings_con_datos_incompletos || 0,
    problemas: (ml.problemas_identificados || []).map(p => ({
      area: p.area,
      descripcion: p.descripcion,
      severidad: p.severidad,
      accion_sugerida: p.accion_sugerida,
    })),
    tendencias: (ml.tendencias_mercado || []).map(t => ({
      indicador: t.indicador,
      tendencia: t.tendencia,
      nota: t.nota,
    })),
    recomendacion_ml: 'Revisar preguntas sin respuesta diariamente y completar listings con datos faltantes para mejorar conversión en ML.',
  };
}

function buildCategorias(competitors) {
  const comps = competitors || [];
  const catMap = {};
  for (const c of comps) {
    const meta = c.metadata || {};
    const productosStr = meta.productos || [];
    const prods = Array.isArray(productosStr) ? productosStr : [productosStr];
    for (const prod of prods) {
      if (!prod) continue;
      const catId = prod.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!catMap[catId]) {
        catMap[catId] = { threats: [], opportunities: [], names: new Set() };
      }
      catMap[catId].threats.push(c.threat_score || 0);
      catMap[catId].opportunities.push(c.opportunity_score || 0);
      catMap[catId].names.add(c.name);
    }
  }
  return PRODUCT_CATEGORIES.map(cat => {
    const catId = cat.id;
    const catKey = Object.keys(catMap).find(k => k.includes(catId) || catId.includes(k));
    const data = catKey ? catMap[catKey] : null;
    const compCount = data ? data.names.size : 0;
    const avgThreat = data && data.threats.length ? data.threats.reduce((a, b) => a + b, 0) / data.threats.length : 0;
    let evaluacion = 'sin_datos';
    let observacion = 'Sin competidores registrados en esta categoría.';
    if (compCount > 0) {
      if (avgThreat >= 3.5) {
        evaluacion = 'debíl';
        observacion = `${compCount} competidores con nivel de amenaza alto (${avgThreat.toFixed(1)}/5). Se requiere monitoreo constante.`;
      } else if (avgThreat >= 2) {
        evaluacion = 'neutral';
        observacion = `${compCount} competidores, amenaza moderada (${avgThreat.toFixed(1)}/5). BMC compite en igualdad de condiciones.`;
      } else {
        evaluacion = 'fuerte';
        observacion = `${compCount} competidores con amenaza baja (${avgThreat.toFixed(1)}/5). BMC tiene ventaja competitiva.`;
      }
    }
    return {
      id: cat.id,
      nombre: cat.label,
      evaluacion,
      productos_monitoreados: 0,
      competidores_activos: compCount,
      observacion,
    };
  });
}

function extractNestedJson(brief) {
  const re = brief.resumen_ejecutivo;
  if (!re || typeof re !== 'string') return;
  const trimmed = re.trim();
  if (!trimmed.startsWith('{')) return;
  let nested = null;
  try { nested = JSON.parse(trimmed); } catch { nested = repairTruncatedJson(trimmed); }
  if (!nested || typeof nested !== 'object') return;
  for (const [k, v] of Object.entries(nested)) {
    if (k === 'resumen_ejecutivo') {
      if (typeof v === 'string' && !v.trim().startsWith('{')) brief.resumen_ejecutivo = v;
    } else if (v != null) {
      const existing = brief[k];
      if (existing == null || (Array.isArray(existing) && existing.length === 0)) brief[k] = v;
    }
  }
}
