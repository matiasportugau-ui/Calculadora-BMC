/**
 * Market price-gap gates — BMC vs tier-weighted competitor reference.
 * Run: node tests/priceGapGates.test.js
 *
 * Pins current behavior. Do not "fix" these in a coverage PR:
 * - family match is String.includes (substring), not a comma-separated token
 * - empty familia matches every row that has a string family
 * - price 0 is scored (analisis) / en_linea (matrix), not treated as cotización
 * - unknown tier multiplier falls back to 1
 */
import assert from "node:assert/strict";
import {
  TIER_MULTIPLIERS,
  refMultiplierForFamily,
  buildAnalisisPrecios,
  buildProductMatrix,
} from "../server/lib/marketIntel/priceGap.js";
import competitorMap from "../server/lib/marketIntel/data/competitorMap.json" with { type: "json" };

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("priceGapGates");

assert.deepEqual(TIER_MULTIPLIERS, { 1: 1.3, 2: 1.05, 3: 0.95, 4: 0.85, 5: 0.7 });
ok("tier multipliers stay premium-above / reseller-below");

{
  const pir = refMultiplierForFamily("panel_techo_pir", competitorMap);
  const techo = refMultiplierForFamily("panel_techo", competitorMap);
  const pared = refMultiplierForFamily("panel_pared", competitorMap);
  const exactMiss = refMultiplierForFamily("panel_techo_pir ", competitorMap);
  const caseMiss = refMultiplierForFamily("Panel_Techo_PIR", competitorMap);
  const empty = refMultiplierForFamily("", competitorMap);
  const missing = refMultiplierForFamily(null, competitorMap);
  const rowsWithText = competitorMap.product_family_mapping.filter(
    (row) => typeof row.familia_principal === "string" || typeof row.familia_secundaria === "string",
  ).length;

  assert.ok(pir.compCount > 0);
  assert.ok(techo.compCount > pir.compCount);
  assert.ok(pared.compCount > 0);
  assert.equal(exactMiss.compCount, 0);
  assert.equal(exactMiss.avgMult, 1);
  assert.equal(caseMiss.compCount, 0);
  assert.equal(empty.compCount, rowsWithText);
  assert.equal(missing.compCount, 0);
  assert.equal(missing.avgMult, 1);
  ok("live map: substring techo is wider than pir; blank family matches every text row; trim and case do not");
}

{
  const map = {
    product_family_mapping: [
      { familia_principal: "panel_techo_pir, panel_pared_eps", tier: 1 },
      { familia_principal: "panel_techo_eps", familia_secundaria: null, tier: 5 },
      { familia_principal: "panel_fachada_premium", familia_secundaria: "panel_techo_pir", tier: "2" },
      { familia_principal: "otro", tier: 9 },
      { familia_principal: null, familia_secundaria: null, tier: 1 },
    ],
  };
  const pir = refMultiplierForFamily("panel_techo_pir", map);
  assert.equal(pir.compCount, 2);
  assert.equal(pir.avgMult, (1.3 + 1.05) / 2);

  const techo = refMultiplierForFamily("panel_techo", map);
  assert.equal(techo.compCount, 3);
  assert.equal(techo.avgMult, (1.3 + 0.7 + 1.05) / 3);

  const unknown = refMultiplierForFamily("otro", map);
  assert.equal(unknown.compCount, 1);
  assert.equal(unknown.avgMult, 1);

  const none = refMultiplierForFamily("panel_techo_pir", null);
  assert.deepEqual(none, { avgMult: 1, compCount: 0 });
  ok("fixture average uses tier 1/5/string-2 and unknown tier 1; null map is neutral");
}

{
  const map = {
    product_family_mapping: [
      { familia_principal: "fam", tier: 1 },
      { familia_principal: "fam", tier: 2 },
    ],
  };
  const price = { producto: "PIR", familia: "fam", precio_publico_usd_m2: 100 };
  const skipped = { producto: "Skip", familia: "fam", precio_publico_usd_m2: null };
  const analisis = buildAnalisisPrecios([price, skipped], map);
  assert.equal(price.precio_publico_usd_m2, 100);
  assert.equal(analisis.brechas.length, 1);
  assert.equal(analisis.brechas[0].precio_referencia_mercado_usd_m2, 117.5);
  assert.equal(analisis.brechas[0].diferencia_usd_m2, -17.5);
  assert.equal(analisis.brechas[0].diferencia_porcentaje, -14.9);
  assert.match(analisis.brechas[0].interpretacion, /14\.9% por debajo/);
  assert.match(analisis.resumen, /1 productos/);
  assert.match(analisis.resumen, /1 oportunidades de margen, 0 con riesgo/);

  const above = buildAnalisisPrecios(
    [{ producto: "EPS", familia: "solo", precio_publico_usd_m2: 100 }],
    { product_family_mapping: [{ familia_secundaria: "solo", tier: 5 }] },
  );
  assert.equal(above.brechas[0].precio_referencia_mercado_usd_m2, 70);
  assert.equal(above.brechas[0].diferencia_usd_m2, 30);
  assert.equal(above.brechas[0].diferencia_porcentaje, 42.9);
  assert.match(above.brechas[0].interpretacion, /42\.9% por encima/);
  assert.match(above.resumen, /0 oportunidades de margen, 1 con riesgo/);

  const aligned = buildAnalisisPrecios(
    [{ producto: "Flat", familia: "missing", precio_publico_usd_m2: 10 }],
    { product_family_mapping: [] },
  );
  assert.equal(aligned.brechas[0].diferencia_usd_m2, 0);
  assert.match(aligned.brechas[0].interpretacion, /alineado/);

  const zero = buildAnalisisPrecios(
    [{ producto: "Zero", familia: "x", precio_publico_usd_m2: 0 }],
    { product_family_mapping: [] },
  );
  assert.equal(zero.brechas.length, 1);
  assert.equal(zero.brechas[0].precio_referencia_mercado_usd_m2, 0);
  assert.equal(Number.isNaN(zero.brechas[0].diferencia_porcentaje), true);
  assert.match(zero.brechas[0].interpretacion, /alineado/);

  const empty = buildAnalisisPrecios(null, map);
  assert.equal(empty.brechas.length, 0);
  assert.match(empty.resumen, /No hay suficientes datos/);
  assert.match(empty.recomendacion_precios, /Sin recomendación/);
  ok("analisis skips null prices, scores 0, and rounds the tier average before the percent");
}

{
  const map = {
    product_family_mapping: [{ familia_principal: "panel_techo_pir", tier: 1 }],
  };
  const rows = buildProductMatrix(
    [
      { sku: "PIR", producto: "PIR", familia: "panel_techo_pir", precio_publico_usd_m2: 10, nucleo: "PIR", espesor_mm: 50 },
      { sku: "COT", producto: "Cotiza", familia: "panel_techo_pir", precio_publico_usd_m2: null },
      { sku: "ZERO", producto: "Zero", familia: "panel_techo_pir", precio_publico_usd_m2: 0 },
    ],
    map,
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].ref_mercado, 13);
  assert.equal(rows[0].delta_pct, -23.1);
  assert.equal(rows[0].posicion, "por_debajo");
  assert.equal(rows[0].competidores, 1);
  assert.equal(rows[0].nucleo, "PIR");
  assert.equal(rows[1].posicion, "cotizacion");
  assert.equal(rows[1].precio_bmc, null);
  assert.equal(rows[1].ref_mercado, null);
  assert.equal(rows[1].delta_pct, null);
  assert.equal(rows[2].posicion, "en_linea");
  assert.equal(rows[2].precio_bmc, 0);
  assert.equal(rows[2].ref_mercado, 0);
  assert.equal(rows[2].delta_pct, 0);

  const rounded = buildProductMatrix(
    [{ sku: "R", producto: "R", familia: "none", precio_publico_usd_m2: 10 }],
    { product_family_mapping: [{ familia_principal: "none", tier: 1 }] },
  );
  assert.equal(rounded[0].ref_mercado, 13);
  assert.equal(rounded[0].posicion, "por_debajo");

  const flat = buildProductMatrix(
    [{ sku: "F", producto: "F", familia: "none", precio_publico_usd_m2: 10 }],
    { product_family_mapping: [] },
  );
  assert.equal(flat[0].posicion, "en_linea");
  assert.equal(flat[0].delta_pct, 0);
  assert.deepEqual(buildProductMatrix(null, map), []);
  ok("matrix keeps quote-only rows; 0 is en_linea; a real gap stays por_debajo after rounding");
}

console.log(`\npriceGapGates: ${passed} passed`);
