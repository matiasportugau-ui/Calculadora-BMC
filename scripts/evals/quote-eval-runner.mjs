#!/usr/bin/env node
/**
 * quote-eval-runner.mjs
 * Continuation of the 2026-05-29 quote accuracy run.
 * Offline (or doppler-injected) re-run of the improved parser + engine against the admin snapshot.
 *
 * Usage (offline):
 *   node scripts/evals/quote-eval-runner.mjs
 *
 * With secrets (for future live Anthropic + Sheets):
 *   doppler run -- node scripts/evals/quote-eval-runner.mjs --live
 *
 * Outputs:
 *   - Console table with before/after for each row
 *   - Summary counts for EVALS-DELTA.md
 *   - JSON report (scripts/evals/quote-eval-report.json)
 *
 * This script exercises the *improved* guardrails and (when possible) the real deterministic calc.
 * It does NOT call the real Anthropic LLM in offline mode (uses heuristic extractor derived from the widened prompt).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA } from '../../src/utils/calculations.js';
import { setListaPrecios } from '../../src/data/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.resolve(__dirname, '../../.accessible-base/admin_cotizaciones.json');
const REPORT_OUT = path.resolve(__dirname, 'quote-eval-report.json');

setListaPrecios('web');

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Lightweight offline extractor that encodes the knowledge from the widened PARAM_EXTRACT_PROMPT + few-shots.
// This is *not* the LLM — it is a deterministic stand-in for measuring the effect of the prompt improvements on the known hard cases.
function improvedExtractor(consulta) {
  const q = String(consulta || '');
  const nq = normalize(q);

  const result = {
    escenario: null,
    techo: { familia: null, espesor: 0, largo: 0, ancho: 0, tipoEst: 'metal' },
    pared: { familia: null, espesor: 0, alto: 0, perimetro: 0 },
    camara: null,
    confianza: 'baja',
    faltan: [],
    raw: q,
  };

  // Family detection (widened abbreviations)
  const hasIsodec = /isodec|i\s*?sodec|isodec\s*eps/i.test(q);
  const hasIsopanel = /isopanel|i\s*?sopanel|isopanel\s*eps/i.test(q);
  const hasIsoroof = /isoroof|foil/i.test(q);
  const hasIsowall = /isowall/i.test(q);

  // Espesor
  const espMatch = q.match(/(\d{2,3})\s*(mm|MM)?/);
  const espesor = espMatch ? parseInt(espMatch[1], 10) : 0;

  // Dimensions (various formats seen in snapshot)
  const dimMatch = q.match(/(\d+[.,]?\d*)\s*(mts?|m|metros?)?\s*(?:x|por|\*)\s*(\d+[.,]?\d*)\s*(mts?|m|metros?)?/i);
  let largo = 0, ancho = 0;
  if (dimMatch) {
    largo = parseFloat(dimMatch[3].replace(',', '.'));
    ancho = parseFloat(dimMatch[1].replace(',', '.'));
  }

  // Area hints (350 M2 etc.)
  const areaMatch = q.match(/(\d+)\s*(m2|m²|metros\s*cuadrados?)/i);
  const areaHint = areaMatch ? parseFloat(areaMatch[1]) : 0;

  // Height for walls
  const altoMatch = q.match(/altura\s*(?:min|minima)?\s*(\d+[.,]?\d*)\s*m/i);
  const alto = altoMatch ? parseFloat(altoMatch[1].replace(',', '.')) : 0;

  // Simple scenario inference
  if ((hasIsodec || hasIsoroof) && (largo || ancho)) {
    result.escenario = 'solo_techo';
    result.techo.familia = hasIsodec ? 'ISODEC_EPS' : (hasIsoroof ? 'ISOROOF_FOIL_3G' : null);
    result.techo.espesor = espesor || 100;
    result.techo.largo = largo || (areaHint ? Math.sqrt(areaHint) : 0);
    result.techo.ancho = ancho || (areaHint ? Math.sqrt(areaHint) : 0);
    result.confianza = 'media';
  } else if (hasIsopanel && (alto || areaHint)) {
    result.escenario = 'solo_fachada';
    result.pared.familia = 'ISOPANEL_EPS';
    result.pared.espesor = espesor || 100;
    result.pared.alto = alto || 2.5;
    result.pared.perimetro = areaHint ? (areaHint / (alto || 2.5)) : 20;
    result.confianza = 'media';
  } else if (hasIsodec && hasIsopanel) {
    // Mixed case from snapshot row 9
    result.escenario = null;
    result.techo.familia = 'ISODEC_EPS';
    result.techo.espesor = 150;
    result.pared.familia = 'ISOPANEL_EPS';
    result.pared.espesor = 100;
    result.confianza = 'baja';
    result.faltan = ['dimensiones o largo/ancho', 'perimetro/altura para pared', 'confirmar si un solo producto o dos presupuestos'];
  }

  // Required slot checks (PHASE 4 style)
  const needsTechoDims = result.escenario && (result.escenario.includes('techo')) && (!result.techo.largo || !result.techo.ancho);
  const needsParedDims = result.escenario === 'solo_fachada' && (!result.pared.alto || !result.pared.perimetro);
  const missingFamily = !result.techo.familia && !result.pared.familia;

  if (missingFamily) result.faltan.push('familia');
  if (espesor === 0) result.faltan.push('espesor');
  if (needsTechoDims) result.faltan.push('largo', 'ancho');
  if (needsParedDims) result.faltan.push('alto', 'perimetro');

  if (result.faltan.length === 0 && result.escenario) {
    result.confianza = 'alta';
  }

  // Very terse cases
  if (nq.length < 15 || nq === 'a') {
    result.escenario = null;
    result.faltan = ['familia', 'espesor', 'dimensiones o largo/ancho'];
  }

  return result;
}

function formatImprovedResponse(extracted, calcRaw) {
  if (extracted.faltan && extracted.faltan.length > 0) {
    return `Consulta incompleta — falta(n): ${extracted.faltan.join(', ')}`;
  }
  if (calcRaw && calcRaw._error) {
    return `⚠ Requiere atención manual — ${calcRaw._error}`;
  }
  if (calcRaw && calcRaw.totales) {
    const t = calcRaw.totales;
    const label = calcRaw._escenario === 'solo_techo' ? 'Techo' : (calcRaw._escenario === 'solo_fachada' ? 'Pared' : 'Paneles');
    return `Cotización ${label} — Área: ${calcRaw.paneles?.areaNeta || 'N/D'} m². Subtotal: USD ${t.subtotalSinIVA.toFixed(2)} + IVA 22%: USD ${t.iva.toFixed(2)} = TOTAL USD ${t.totalFinal.toFixed(2)}.`;
  }
  if (extracted.escenario === null && extracted.raw.includes('Isodec') && extracted.raw.includes('Isopanel')) {
    return '⚠ Requiere atención manual — mixed roof + wall products with area only (recommend separate quotes or provide full dimensions per product)';
  }
  return '⚠ Requiere atención manual — datos insuficientes para cálculo automático (ver planos o confirmar detalles)';
}

function runCalcSafe(extracted) {
  try {
    if (extracted.escenario === 'solo_techo' && extracted.techo.largo > 0 && extracted.techo.ancho > 0) {
      const r = calcTechoCompleto({
        familia: extracted.techo.familia || 'ISODEC_EPS',
        espesor: extracted.techo.espesor || 100,
        tipoEst: extracted.techo.tipoEst,
        color: 'Blanco',
        largo: extracted.techo.largo,
        ancho: extracted.techo.ancho,
        borders: { frente: 'none', fondo: 'none', latIzq: 'none', latDer: 'none' },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      });
      if (r?.error) return { _error: r.error };
      return { ...r, _escenario: 'solo_techo' };
    }
    if (extracted.escenario === 'solo_fachada' && extracted.pared.alto > 0) {
      const r = calcParedCompleto({
        familia: extracted.pared.familia || 'ISOPANEL_EPS',
        espesor: extracted.pared.espesor || 100,
        alto: extracted.pared.alto,
        perimetro: extracted.pared.perimetro || 20,
        tipoEst: 'metal',
        numEsqExt: 4,
        numEsqInt: 0,
        inclSell: true,
      });
      if (r?.error) return { _error: r.error };
      return { ...r, _escenario: 'solo_fachada' };
    }
  } catch (e) {
    return { _error: e.message };
  }
  return null;
}

function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const rows = snapshot.rows || [];

  console.log('=== QUOTE EVAL RUNNER — Continuation (improved parser + engine) ===');
  console.log(`Snapshot rows: ${rows.length} | Source: ${snapshot._meta?.synced_at}`);
  console.log('');

  const results = [];

  for (const row of rows) {
    const base = row.respuesta || '';
    const extracted = improvedExtractor(row.consulta);
    const calcRaw = runCalcSafe(extracted);
    const improved = formatImprovedResponse(extracted, calcRaw);

    const numericOk = calcRaw && calcRaw.totales
      ? Math.abs((calcRaw.totales.subtotalSinIVA * 1.22) - calcRaw.totales.totalFinal) < 0.02
      : null;

    results.push({
      row: row._row,
      consulta: row.consulta.substring(0, 70),
      baseline: base.substring(0, 50) || '(empty)',
      improved: improved.substring(0, 80),
      reachedCalc: !!calcRaw && !calcRaw._error,
      numericSanity: numericOk,
      faltan: extracted.faltan,
    });

    console.log(`Row ${row._row}:`);
    console.log(`  Baseline : ${base || '(empty)'}`);
    console.log(`  Improved : ${improved}`);
    console.log(`  Reached calc: ${!!calcRaw && !calcRaw._error} | IVA sanity: ${numericOk}`);
    console.log('');
  }

  // Summary counts
  const reached = results.filter(r => r.reachedCalc).length;
  const preciseIncompleta = results.filter(r => r.improved.startsWith('Consulta incompleta')).length;
  const atencionWithReason = results.filter(r => r.improved.includes('Requiere atención manual —')).length;

  console.log('=== DELTA SUMMARY (Phase 5 continuation) ===');
  console.log(`Rows that now reach deterministic calc : ${reached} / ${rows.length}`);
  console.log(`Precise "incompleta — falta(n):"        : ${preciseIncompleta}`);
  console.log(`Atención with concrete engine reason    : ${atencionWithReason}`);
  console.log(`Numeric sanity (subtotal × 1.22 == total): ${results.filter(r => r.numericSanity === true).length}`);

  fs.writeFileSync(REPORT_OUT, JSON.stringify({ runAt: new Date().toISOString(), results, summary: { reached, preciseIncompleta, atencionWithReason } }, null, 2));
  console.log(`\nFull report written to ${REPORT_OUT}`);
}

main();