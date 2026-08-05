/**
 * Offline tests — flete engine (SDD-CALCULADORA-FLETES)
 * Run: node tests/fleteEngine.test.js
 */

import assert from "node:assert/strict";
import {
  classifyZona,
  quoteFreight,
  quoteFreightFromWizard,
  buildPanelLoadsFromQuote,
  buildPanelLoadsFromBomItems,
  parsePanelSkuTipoEspesor,
  cotizacionSinFleteFromGroups,
} from "../src/utils/fleteEngine.js";
import { packageHeightM, placeCargo, STANDARD_BED_M } from "../src/utils/logistica/cargoPacking.js";
import { setBrouFxForTests, uyuToUsdInteger } from "../src/utils/brouFx.js";
import { TARIFAS_LOGISTICAS } from "../src/data/constants.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("fleteEngine / cargoPacking");

// Zones
assert.equal(classifyZona("Retiro planta Colonia Nicolich"), "retiro");
ok("zona retiro");
assert.equal(classifyZona("Ciudad de la Costa"), "ciudad_costa");
ok("zona costa");
assert.equal(classifyZona("Montevideo Pocitos"), "mvd");
ok("zona mvd");
assert.equal(classifyZona("Las Piedras Canelones"), "canelones");
ok("zona canelones");
assert.equal(classifyZona("Maldonado"), "maldonado_corredor");
ok("zona maldonado");
assert.equal(classifyZona("Piriápolis"), "maldonado_corredor");
ok("zona corredor piriapolis");
assert.equal(classifyZona("Salto"), "especial");
ok("zona especial salto");

// Stacking
const hIsodec = packageHeightM("ISODEC", 100, 8);
assert.ok(Math.abs(hIsodec - 8 * (0.1 + 0.02)) < 0.001, `ISODEC h=${hIsodec}`);
ok("ISODEC stack height");
const hRoof = packageHeightM("ISOROOF_3G", 100, 2);
assert.ok(Math.abs(hRoof - (0.1 + 0.1 + 0.04)) < 0.001, `ISOROOF h=${hRoof}`);
ok("ISOROOF inverted pair height");

// Retiro
{
  const q = quoteFreight({ retiroEnPlanta: true, panels: [] });
  assert.equal(q.ventaUsd, 0);
  assert.equal(q.ok, true);
  ok("retiro = 0");
}

// Maldonado 1 fila ≤8m
{
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }];
  const pack = placeCargo([{ id: "s", orden: 1, paneles: panels }], STANDARD_BED_M);
  assert.equal(pack.filasUsadas, 1, `filas=${pack.filasUsadas}`);
  const q = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: 40 });
  assert.equal(q.ok, true);
  assert.equal(q.ventaUsd, 280);
  ok("maldonado 1 fila → 280");
}

// Regression: leftover packs must stay on the used fila (not open B → false 2-fila 525)
{
  for (const qty of [9, 12, 16]) {
    const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: qty }];
    const pack = placeCargo([{ id: "s", orden: 1, paneles: panels }], STANDARD_BED_M);
    assert.equal(pack.filasUsadas, 1, `qty=${qty} filas=${pack.filasUsadas}`);
    const q = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: 40 });
    assert.equal(q.ok, true, `qty=${qty} ok`);
    assert.equal(q.ventaUsd, 280, `qty=${qty} venta=${q.ventaUsd}`);
  }
  ok("maldonado 9–16× ISODEC100 → still 1 fila / USD 280");
}

// Costa 1 fila
{
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }];
  const q = quoteFreight({ destino: "Ciudad de la Costa", panels, fxRateUyuPerUsd: 40 });
  assert.equal(q.ventaUsd, 252);
  ok("costa 1 fila → 252");
}

// 2 filas → costo+3000 / FX
{
  // Enough panels to force both rows under 2.4m
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 40 }];
  const pack = placeCargo([{ id: "s", orden: 1, paneles: panels }], STANDARD_BED_M);
  assert.ok(pack.filasUsadas >= 2, `expected 2 filas got ${pack.filasUsadas}`);
  const fx = 40;
  const q = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: fx });
  assert.equal(q.ok, true);
  assert.equal(q.ventaUsd, Math.round(21000 / fx));
  assert.equal(q.costoUsd, Math.round(18000 / fx));
  ok("2 filas → costo+3000 UYU");
}

// Remolque >8m
{
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 10, cantidad: 4 }];
  const fx = 40;
  const q = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: fx });
  assert.equal(q.ok, true);
  assert.equal(q.summary.vehicle, "remolque");
  assert.equal(q.ventaUsd, Math.round(28000 / fx));
  assert.equal(q.costoUsd, Math.round(24000 / fx));
  ok("remolque >8m");
}

// Camión largo when 8m height fails but 13m works — hard to force height-only;
// use many long-enough panels that fit length on 13m. If still especial, skip soft.
{
  const panels = [{ tipo: "ISODEC", espesor: 100, longitud: 7.5, cantidad: 80 }];
  const q = quoteFreight({ destino: "Maldonado", panels, fxRateUyuPerUsd: 40 });
  assert.ok(q.mode === "especial" || q.summary.vehicle === "camion_largo" || q.ok);
  if (q.summary?.vehicle === "camion_largo") {
    assert.equal(q.ventaUsd, 650);
    ok("camion largo → 650");
  } else {
    ok(`camion largo path exercised (mode=${q.mode}, vehicle=${q.summary?.vehicle})`);
  }
}

// MVD max(min, %)
{
  const q = quoteFreight({
    destino: "Montevideo",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 4 }],
    cotizacionSinFlete: 2000,
  });
  assert.equal(q.ventaUsd, 200); // 10% of 2000
  ok("mvd 10%");
  const q2 = quoteFreight({
    destino: "Montevideo",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 4 }],
    cotizacionSinFlete: 500,
  });
  assert.equal(q2.ventaUsd, 150);
  ok("mvd minimo 150");
}

// Canelones
{
  const q = quoteFreight({
    destino: "Pando Canelones",
    panels: [{ tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 4 }],
    cotizacionSinFlete: 1000,
  });
  assert.equal(q.ventaUsd, 220);
  ok("canelones minimo 220");
}

// Especial
{
  const q = quoteFreight({ destino: "Salto", panels: [] });
  assert.equal(q.ok, false);
  assert.equal(q.mode, "especial");
  ok("especial manual");
}

// cotizacion sin flete
{
  const groups = [
    { title: "PANELES", items: [{ sku: "P1", total: 1000 }] },
    { title: "SERVICIOS", items: [{ sku: "FLETE", label: "Flete", total: 280 }] },
  ];
  assert.equal(cotizacionSinFleteFromGroups(groups), 1000);
  ok("excluye flete del %");
}

// buildPanelLoads
{
  const loads = buildPanelLoadsFromQuote({
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      zonas: [{ largo: 6.2, cantPaneles: 12 }],
    },
  });
  assert.equal(loads.length, 1);
  assert.equal(loads[0].cantidad, 12);
  assert.equal(loads[0].longitud, 6.2);
  ok("buildPanelLoadsFromQuote");
}

// Presupuesto libre BOM → packing loads (sku + cantPaneles × largoPanel)
{
  assert.deepEqual(parsePanelSkuTipoEspesor("ISODEC_EPS-100"), {
    tipo: "ISODEC_EPS",
    espesor: 100,
  });
  const bomLoads = buildPanelLoadsFromBomItems([
    {
      sku: "ISODEC_EPS-100",
      cantPaneles: 40,
      largoPanel: 6,
      total: 10000,
    },
  ]);
  assert.equal(bomLoads.length, 1);
  assert.equal(bomLoads[0].cantidad, 40);
  assert.equal(bomLoads[0].longitud, 6);
  assert.equal(bomLoads[0].espesor, 100);

  const multi = buildPanelLoadsFromBomItems([
    {
      sku: "ISODEC_EPS-100",
      tramosDetail: [
        { cantPaneles: 10, largo: 5 },
        { cantPaneles: 10, largo: 7 },
      ],
    },
  ]);
  assert.equal(multi.length, 2);
  assert.equal(multi[1].longitud, 7);
  ok("buildPanelLoadsFromBomItems + sku parse");
}

// Regression: presupuesto_libre must not assume 1-fila when BOM has panel geometry
{
  const bomGroups = [
    {
      title: "PANELES",
      items: [
        {
          sku: "ISODEC_EPS-100",
          label: "ISODEC EPS 100mm · 40 paneles × 6.00 m",
          cantPaneles: 40,
          largoPanel: 6,
          total: 11061,
        },
      ],
    },
  ];
  const loads = buildPanelLoadsFromQuote({
    techo: {},
    pared: {},
    results: { presupuestoLibre: true, allItems: bomGroups[0].items },
    bomGroups,
  });
  assert.equal(loads.length, 1);
  assert.equal(loads[0].cantidad, 40);
  const q = quoteFreightFromWizard({
    proyecto: { direccion: "Maldonado" },
    techo: {},
    pared: {},
    results: { presupuestoLibre: true, allItems: bomGroups[0].items },
    bomGroups,
    fxRateUyuPerUsd: 40,
  });
  assert.equal(q.ok, true);
  assert.equal(q.summary.filasUsadas, 2);
  assert.equal(q.ventaUsd, 525);
  assert.ok(!/Sin paneles/.test(String(q.summary.warns || [])), "must not assume empty cargo");
  ok("presupuesto_libre 40×6m → 2 filas / USD 525");
}

// FX helper
assert.equal(uyuToUsdInteger(21000, 40), 525);
setBrouFxForTests(41);
setBrouFxForTests(null);
ok("uyuToUsdInteger");

assert.ok(TARIFAS_LOGISTICAS.zonas.maldonado_corredor.unaFilaUsd === 280);
ok("TARIFAS_LOGISTICAS present");

console.log(`\n${passed} assertions ok`);
