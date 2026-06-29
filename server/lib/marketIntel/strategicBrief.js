// Module: strategic-brief | Owner: bmc-dev | Created: 2026-06-29
// Generates AI-powered strategic analysis of product intelligence data.

import pino from 'pino';
import { callAgentOnce } from '../agentCore.js';
import { getEtlSummary, PRODUCT_CATEGORIES } from './productIntelligence.js';

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
      "area": "pricing|producto|competencia|estrategia",
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
  "resumen_ejecutivo": "Un párrafo de 2-3 oraciones con el panorama general"
}

## PRINCIPIOS DE ANÁLISIS
1. Identifica productos con brecha de precio favorable (oportunidad de margen).
2. Señala categorías donde BMC tiene poca o ninguna competencia (liderazgo).
3. Cruza los perfiles de competidores (tipo, tier, threat_score, opportunity_score) con las categorías de producto para identificar patrones.
4. Aunque los datos de precios históricos sean limitados, debes generar análisis útil usando: perfiles de competidores, su posicionamiento (tier), su nivel de amenaza/oportunidad (threat_score/opportunity_score), y las categorías de BMC.
5. Genera al menos 2-3 ítems en oportunidades, señales y recomendaciones usando los datos disponibles. Si hay poca data, sé creativo pero fundado.
6. Para evaluacion por categoría, usa "sin_datos" solo si no hay competidores en esa categoría; caso contrario asigna "fuerte", "neutral" o "debíl" según el threat_score promedio de los competidores que operan ahí.`;

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

export async function generateStrategicBrief() {
  const summary = await getEtlSummary();

  const categoriesInfo = PRODUCT_CATEGORIES.map(c =>
    `- ${c.label} (id: ${c.id})`
  ).join('\n');

  const competitorBlock = formatCompetitorData(summary.competitors);
  const etlBlock = formatEtlData(summary);

  const userContent = `## Datos de competidores
${competitorBlock}

## Estado ETL
${etlBlock}

## Categorías de producto
${categoriesInfo}

## Productos de BMC
BMC Uruguay vende paneles aislantes para techos (ISODEC EPS/PIR, ISOROOF 3G/FOIL/COLONIAL/PLUS) y paredes (ISOPANEL EPS, ISOWALL PIR, ISOFRIG PIR), además de perfiles, fijaciones y selladores.

Genera el brief estratégico en formato JSON.`;

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
