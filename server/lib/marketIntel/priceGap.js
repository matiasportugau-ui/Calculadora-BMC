// Module: market-intelligence/price-gap | Owner: bmc-dev
// Shared price-gap logic: compares BMC baseline prices against a tier-weighted
// competitor "market reference" derived from the offline competitor map.
//
// The reference is a heuristic (we rarely have a live competitor price for every
// BMC family), so it must be presented to operators as an *estimate*. The tier
// multipliers encode how each competitor tier typically prices relative to BMC:
// tier-1 fabricantes/importadores sit above (premium), tier-5 MLU resellers below.
//
// Reused by:
//   - strategicBrief.js   → buildAnalisisPrecios() (AI brief "análisis de precios")
//   - routes/marketing.js → GET /api/marketing/product-matrix

export const TIER_MULTIPLIERS = { 1: 1.3, 2: 1.05, 3: 0.95, 4: 0.85, 5: 0.7 };

/**
 * Average tier multiplier (+ competitor count) for a BMC product family,
 * based on which competitors cover that family in the offline competitor map.
 * @returns {{ avgMult:number, compCount:number }}
 */
export function refMultiplierForFamily(familia, compMap) {
  const families = compMap?.product_family_mapping || [];
  const relevant = families.filter(
    (f) =>
      f.familia_principal?.includes(familia) ||
      f.familia_secundaria?.includes(familia)
  );
  const mults = relevant.map((c) => TIER_MULTIPLIERS[c.tier] || 1);
  const avgMult = mults.length
    ? mults.reduce((a, b) => a + b, 0) / mults.length
    : 1;
  return { avgMult, compCount: relevant.length };
}

/**
 * AI-brief price-gap analysis. Behaviour preserved verbatim from the original
 * implementation in strategicBrief.js (only SKUs with a public price are scored).
 */
export function buildAnalisisPrecios(prices, compMap) {
  const brechas = [];
  for (const p of prices || []) {
    const bmcPrice = p.precio_publico_usd_m2;
    if (bmcPrice == null) continue;
    const { avgMult } = refMultiplierForFamily(p.familia, compMap);
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
      ? `Se analizaron ${brechas.length} productos de BMC. ${brechas.filter((b) => b.diferencia_usd_m2 < 0).length} oportunidades de margen, ${brechas.filter((b) => b.diferencia_usd_m2 > 0).length} con riesgo de volumen.`
      : 'No hay suficientes datos de precios para generar análisis.',
    brechas,
    recomendacion_precios: brechas.length
      ? 'Revisar productos con brecha positiva (BMC por encima del mercado) para evitar pérdida de volumen. Aprovechar brechas negativas para ajustar márgenes gradualmente.'
      : 'Sin recomendación disponible por falta de datos.',
  };
}

/**
 * Dashboard product matrix: every BMC SKU with its baseline price, the
 * tier-weighted market reference, the delta, and a positioning label.
 * Unlike buildAnalisisPrecios this keeps quote-only SKUs (price null) so the
 * operator sees the full catalogue.
 *
 * @returns {Array<{ sku, producto, nucleo, espesor_mm, familia,
 *   precio_bmc:number|null, ref_mercado:number|null, delta_pct:number|null,
 *   posicion:'por_debajo'|'en_linea'|'por_encima'|'cotizacion', competidores:number }>}
 */
export function buildProductMatrix(prices, compMap) {
  return (prices || []).map((p) => {
    const bmc = p.precio_publico_usd_m2;
    const { avgMult, compCount } = refMultiplierForFamily(p.familia, compMap);
    const base = {
      sku: p.sku,
      producto: p.producto,
      nucleo: p.nucleo ?? null,
      espesor_mm: p.espesor_mm ?? null,
      familia: p.familia ?? null,
      competidores: compCount,
    };
    if (bmc == null) {
      return { ...base, precio_bmc: null, ref_mercado: null, delta_pct: null, posicion: 'cotizacion' };
    }
    const ref = +(bmc * avgMult).toFixed(2);
    const diff = +(bmc - ref).toFixed(2);
    const deltaPct = ref ? +((diff / ref) * 100).toFixed(1) : 0;
    const posicion = diff > 0 ? 'por_encima' : diff < 0 ? 'por_debajo' : 'en_linea';
    return { ...base, precio_bmc: bmc, ref_mercado: ref, delta_pct: deltaPct, posicion };
  });
}
