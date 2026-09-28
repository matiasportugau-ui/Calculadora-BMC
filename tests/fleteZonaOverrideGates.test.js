/**
 * Freight zone order, retiro override, costa factor, and panel-load floors.
 * tests/fleteEngine.test.js still passes if these branches move.
 * Run: node tests/fleteZonaOverrideGates.test.js
 */
import assert from "node:assert/strict";
import {
  buildPanelLoadsFromQuote,
  classifyZona,
  cotizacionSinFleteFromGroups,
  quoteFreight,
  quoteFreightFromWizard,
} from "../src/utils/fleteEngine.js";

console.log("fleteZonaOverrideGates");

assert.equal(classifyZona(""), "especial");
assert.equal(classifyZona("   "), "especial");
assert.equal(classifyZona("Colinas de Carrasco"), "ciudad_costa");
assert.equal(classifyZona("Carrasco"), "mvd");
assert.equal(classifyZona("Nicolich"), "retiro");
assert.equal(classifyZona("colonia nicolich"), "retiro");
assert.equal(classifyZona("Colonia"), "especial");
assert.equal(classifyZona("Colonia del Sacramento"), "especial");
assert.equal(classifyZona("Shangrila"), "ciudad_costa");
assert.equal(classifyZona("SHANGRILA"), "ciudad_costa");
assert.equal(classifyZona("Shangrilá"), "especial");
assert.equal(classifyZona("Cerro"), "mvd");
assert.equal(classifyZona("Cerro Largo"), "mvd");
assert.equal(classifyZona("Atlántida"), "maldonado_corredor");
assert.equal(classifyZona("Atlantida"), "maldonado_corredor");
assert.equal(classifyZona("José Ignacio"), "maldonado_corredor");
assert.equal(classifyZona("Jose Ignacio"), "maldonado_corredor");
assert.equal(classifyZona("Río Negro"), "especial");
assert.equal(classifyZona("Rio Negro"), "especial");
assert.equal(classifyZona("Florida"), "especial");
assert.equal(classifyZona("La Paz"), "canelones");
console.log("  ✓ zone order: costa before mvd, nicolich before colonia, accent edges");

{
  const q = quoteFreight({
    retiroEnPlanta: true,
    destino: "Salto",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 4 }],
    cotizacionSinFlete: 5000,
  });
  assert.equal(q.ok, true);
  assert.equal(q.ventaUsd, 0);
  assert.equal(q.costoUsd, 0);
  assert.equal(q.summary.zona, "retiro");
  console.log("  ✓ retiroEnPlanta beats a Salto address ($0, not especial)");
}

{
  const q = quoteFreight({ destino: "   ", panels: [] });
  assert.equal(q.ok, false);
  assert.equal(q.mode, "especial");
  assert.equal(q.error, "zona_especial");
  assert.equal(q.ventaUsd, null);
  console.log("  ✓ blank destino is manual especial, not USD 0");
}

{
  const q = quoteFreight({
    destino: "Pocitos",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 4 }],
    cotizacionSinFlete: 1555,
  });
  assert.equal(q.ok, true);
  assert.equal(q.summary.zona, "mvd");
  assert.equal(q.ventaUsd, 156);
  assert.match(q.summary.label, /10% = 156/);
  console.log("  ✓ MVD 10% of 1555 rounds half up to 156");
}

{
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 40 }];
  const mald = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: 40 });
  const costa = quoteFreight({ destino: "Solymar", panels, fxRateUyuPerUsd: 40 });
  assert.equal(mald.summary.vehicle, "estandar_2_filas");
  assert.equal(costa.summary.vehicle, "estandar_2_filas");
  assert.equal(costa.summary.zona, "ciudad_costa");
  assert.equal(costa.ventaUsd, Math.round(mald.ventaUsd * 0.9));
  assert.equal(costa.costoUsd, Math.round(mald.costoUsd * 0.9));
  assert.equal(costa.ventaUsd, 473);
  assert.equal(costa.costoUsd, 405);
  assert.notEqual(costa.ventaUsd, mald.ventaUsd);
  console.log("  ✓ Costa 2-filas is 0.9× the Maldonado UYU conversion");
}

{
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 40 }];
  for (const fx of [0, -1, null]) {
    const q = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: fx });
    assert.equal(q.ok, false);
    assert.equal(q.mode, "needs_fx");
    assert.equal(q.error, "needs_fx");
    assert.equal(q.ventaUsd, null);
    assert.deepEqual(q.pendingUyu, { ventaUyu: 21000, costoUyu: 18000 });
  }
  console.log("  ✓ fx 0, negative, and null stay needs_fx (no UYU division)");
}

{
  const groups = [
    {
      items: [
        { sku: "P-FLETE", label: "Panel", total: 80 },
        { sku: "X", label: "Flete interior", total: 40 },
        { sku: "flete", label: "no", total: 15 },
      ],
    },
  ];
  assert.equal(cotizacionSinFleteFromGroups(groups), 80);
  assert.equal(groups[0].items.length, 3);
  assert.equal(cotizacionSinFleteFromGroups(null, "12"), 12);
  assert.equal(cotizacionSinFleteFromGroups(null, -5), 0);
  assert.equal(cotizacionSinFleteFromGroups("no", 4), 4);
  console.log("  ✓ only exact sku FLETE or a flete label leaves the % base");
}

{
  const zonas = [
    { largo: 6, cantPaneles: 12.9, espesor: 50 },
    { largo: 0, cantPaneles: 4, espesor: 50 },
    { largo: 5, cantPaneles: -3, espesor: 50 },
  ];
  const loads = buildPanelLoadsFromQuote({
    techo: { familia: "ISODEC", espesor: 0, zonas },
    pared: { familia: "ISOPANEL", espesor: 80, alto: 3, cantPaneles: 4.2 },
  });
  assert.equal(zonas[0].cantPaneles, 12.9);
  assert.deepEqual(loads, [
    { tipo: "ISODEC", espesor: 50, longitud: 6, cantidad: 12 },
    { tipo: "ISOPANEL", espesor: 80, longitud: 3, cantidad: 4 },
  ]);
  console.log("  ✓ panel counts floor; zero largo and negative qty are dropped");
}

{
  const q = quoteFreightFromWizard({
    proyecto: { direccion: "Ruta 8", departamento: "Pando", localidad: null },
    techo: { familia: "ISODEC", espesor: 100, zonas: [{ largo: 5, cantPaneles: 4 }] },
    bomGroups: [{ items: [{ sku: "P1", total: 10000 }, { sku: "FLETE", total: 999 }] }],
  });
  assert.equal(q.ok, true);
  assert.equal(q.summary.zona, "canelones");
  assert.equal(q.ventaUsd, 1000);
  console.log("  ✓ wizard joins departamento into the zone and drops the flete line");
}

console.log("fleteZonaOverrideGates OK");
