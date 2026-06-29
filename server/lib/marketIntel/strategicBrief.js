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
  "categorias": [
    {
      "id": "id de categoría",
      "nombre": "nombre legible",
      "evaluacion": "fuerte|neutral|debíl|sin_datos",
      "productos_monitoreados": 0,
      "competidores_activos": 0,
      "observacion": "una línea de análisis"
    }
  ],
  "analisis_precios": {
    "resumen": "Análisis general de posicionamiento de precios de BMC frente a competidores.",
    "brechas": [
      {
        "producto": "nombre del producto BMC",
        "precio_bmc_usd_m2": 0.00,
        "precio_referencia_mercado_usd_m2": 0.00,
        "diferencia_usd_m2": 0.00,
        "diferencia_porcentaje": 0.0,
        "interpretacion": "BMC está X% por encima/debajo del mercado. Implicancia estratégica."
      }
    ],
    "recomendacion_precios": "Recomendación general sobre estrategia de precios."
  },
  "analisis_ads": {
    "resumen": "Análisis de la estrategia actual de Meta Ads de BMC.",
    "big_4_campanas": [
      {
        "nombre": "nombre de campaña",
        "inversion_mensual_usd": 0,
        "objetivo": "lead_generation|traffic|conversions",
        "rendimiento": "alto|medio|bajo",
        "notas": "observación"
      }
    ],
    "total_campanas": 0,
    "campanas_zombie": 0,
    "diagnostico": "diagnóstico general de la cuenta de ads",
    "recomendacion_ads": "Recomendación concreta sobre la estrategia de ads."
  },
  "analisis_ml": {
    "resumen": "Análisis de la presencia de BMC en MercadoLibre Uruguay.",
    "preguntas_sin_respuesta": 0,
    "listings_con_imagenes_faltantes": 0,
    "listings_con_datos_incompletos": 0,
    "problemas": [
      {
        "area": "calidad_datos|preguntas_sin_respuesta|titulos|otros",
        "descripcion": "descripción del problema",
        "severidad": "alta|media|baja",
        "accion_sugerida": "qué hacer"
      }
    ],
    "tendencias": [
      {
        "indicador": "nombre del indicador",
        "tendencia": "estable|alta|baja|presión_alta",
        "nota": "interpretación"
      }
    ],
    "recomendacion_ml": "Recomendación concreta para mejorar presencia en ML."
  },
  "resumen_ejecutivo": "Un párrafo de 2-3 oraciones con el panorama general que integre precios, ads y ML."
}

## PRINCIPIOS DE ANÁLISIS
1. Identifica productos con brecha de precio favorable (oportunidad de margen).
2. Señala categorías donde BMC tiene poca o ninguna competencia (liderazgo).
3. Cruza los perfiles de competidores (tipo, tier, threat_score, opportunity_score) con las categorías de producto para identificar patrones.
4. Aunque los datos de precios históricos sean limitados, debes generar análisis útil usando: perfiles de competidores, su posicionamiento (tier), su nivel de amenaza/oportunidad (threat_score/opportunity_score), y las categorías de BMC.
5. Genera al menos 2-3 ítems en oportunidades, señales y recomendaciones usando los datos disponibles. Si hay poca data, sé creativo pero fundado.
6. Para evaluacion por categoría, usa "sin_datos" solo si no hay competidores en esa categoría; caso contrario asigna "fuerte", "neutral" o "debíl" según el threat_score promedio de los competidores que operan ahí.
7. En analisis_precios, compara los precios públicos de BMC contra los rangos estimados de competidores según tier (T1=precio premium, T2/T3=precio medio, T5=precio agresivo bajo). Calcula brechas aunque sean estimadas.
8. En analisis_ads, usa los datos de campañas Big 4, el diagnóstico Ghost Town, y la recomendación ASC para generar análisis.
9. En analisis_ml, usa los datos de preguntas sin respuesta, listings incompletos, y tendencias estacionales para generar recomendaciones accionables.`;

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

Genera el brief estratégico en formato JSON. Las secciones analisis_precios, analisis_ads y analisis_ml son obligatorias. Usa los datos proporcionados para generar análisis concretos y accionables.`;

  try {
    const result = await callAgentOnce(
      [
        { role: 'system', content: STRATEGIC_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      { channel: 'chat' }
    );

    const raw = result.text;
    log.info({ raw_preview: raw.slice(0, 300), provider: result.provider }, 'AI raw response');

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
