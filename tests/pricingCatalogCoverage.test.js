/**
 * Regression coverage for recent catalog/pricing changes.
 * Run: node tests/pricingCatalogCoverage.test.js
 */

import {
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  SELLADORES,
  PERFIL_TECHO,
  PERFIL_PARED,
  SERVICIOS,
  HERRAMIENTAS,
  clearPanelinPricingCache,
  setListaPrecios,
  setPanelinPricingCache,
  setUsePanelinPricing,
} from "../src/data/constants.js";
import {
  getPricing,
  getPricingItemsFlat,
  invalidatePricingCache,
} from "../src/data/pricing.js";
import {
  calcParedCompleto,
  resolvePerfilPared,
  resolveSKU_techo,
} from "../src/utils/calculations.js";

let passed = 0;
let failed = 0;

function assert(condition, label, actual, expected) {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`  ✗ ${label}`);
  if (arguments.length >= 3) console.error("    actual:  ", actual);
  if (arguments.length >= 4) console.error("    expected:", expected);
}

function assertEqual(actual, expected, label) {
  assert(Object.is(actual, expected), label, actual, expected);
}

function assertClose(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, label, actual, expected);
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

function resetPricingState() {
  setListaPrecios("web");
  setUsePanelinPricing(false);
  clearPanelinPricingCache();
  invalidatePricingCache();
}

function buildPanelinCache() {
  return JSON.parse(JSON.stringify({
    PANELS_TECHO,
    PANELS_PARED,
    FIJACIONES,
    SELLADORES,
    PERFIL_TECHO,
    PERFIL_PARED,
    SERVICIOS,
    HERRAMIENTAS,
  }));
}

group("Panelin pricing cache — complete cache wins, empty/partial cache falls back", () => {
  resetPricingState();

  const live = buildPanelinCache();
  live.PANELS_PARED.ISOFRIG_PIR.esp["100"].web = 123.45;
  setUsePanelinPricing(true);
  setPanelinPricingCache(live);
  assertEqual(
    getPricing().PANELS_PARED.ISOFRIG_PIR.esp["100"].web,
    123.45,
    "complete Panelin cache overrides baked ISOFRIG price",
  );

  setUsePanelinPricing(false);
  invalidatePricingCache();
  assertEqual(
    getPricing().PANELS_PARED.ISOFRIG_PIR.esp["100"].web,
    76.9454,
    "disabled Panelin flag restores baked constants path",
  );

  setUsePanelinPricing(true);
  setPanelinPricingCache({ PANELS_PARED: live.PANELS_PARED });
  invalidatePricingCache();
  assertEqual(
    getPricing().PANELS_PARED.ISOFRIG_PIR.esp["100"].web,
    76.9454,
    "partial Panelin cache is ignored instead of breaking missing roots",
  );

  setPanelinPricingCache({});
  invalidatePricingCache();
  assertEqual(
    getPricing().PANELS_PARED.ISOFRIG_PIR.esp["100"].web,
    76.9454,
    "empty Panelin cache falls back to baked constants",
  );
});

group("Pricing editor flatten — new high-risk catalog rows are editable", () => {
  resetPricingState();
  const byPath = new Map(getPricingItemsFlat().map((item) => [item.path, item]));

  assertEqual(
    byPath.get("PANELS_PARED.ISOFRIG_PIR.esp.200")?.web,
    111.0032,
    "ISOFRIG 200mm panel row is visible to pricing editor",
  );
  assertEqual(
    byPath.get("PERFIL_PARED.perfil_u.ISOFRIG.180")?.sku,
    "PU200MM",
    "ISOFRIG 180mm Perfil U row resolves to PU200MM",
  );
  assertEqual(
    byPath.get("PERFIL_TECHO.gotero_frontal.ISOROOF.100")?.sku,
    "GFS100",
    "ISOROOF 100mm gotero frontal row is visible",
  );
  assertEqual(
    byPath.get("PERFIL_TECHO.gotero_lateral.ISOROOF.100")?.sku,
    "GL100",
    "ISOROOF 100mm gotero lateral row is visible",
  );
  assertEqual(
    byPath.get("PERFIL_TECHO.gotero_superior.ISOROOF.100")?.sku,
    "GFSUP100",
    "ISOROOF 100mm gotero superior row is visible",
  );
  assertEqual(
    byPath.get("PERFIL_TECHO.canalon.ISOROOF.100")?.sku,
    "CD100",
    "ISOROOF 100mm canalon row is visible",
  );
});

group("Resolver mappings — ISOFRIG U profiles and ISOROOF 100mm accessories", () => {
  resetPricingState();

  const expectedIsofrigU = new Map([
    [40, "PU50MM"],
    [60, "PU50MM"],
    [80, "PU100MM"],
    [100, "PU100MM"],
    [120, "PU150MM"],
    [150, "PU150MM"],
    [180, "PU200MM"],
    [200, "PU200MM"],
  ]);

  for (const [espesor, expectedSku] of expectedIsofrigU) {
    const resolved = resolvePerfilPared("perfil_u", "ISOFRIG", espesor);
    assertEqual(resolved?.sku, expectedSku, `ISOFRIG ${espesor}mm Perfil U SKU`);
    assert(
      Number.isFinite(resolved?.web) && resolved.web > 0 && Number.isFinite(resolved?.costo) && resolved.costo > 0,
      `ISOFRIG ${espesor}mm Perfil U has usable web/costo`,
      resolved,
      "positive web/costo",
    );
  }

  const expectedRoof100 = [
    { tipo: "gotero_frontal", familia: "ISOROOF", expectedSku: "GFS100" },
    { tipo: "gotero_lateral", familia: "ISOROOF", expectedSku: "GL100" },
    { tipo: "gotero_superior", familia: "ISOROOF", expectedSku: "GFSUP100" },
    { tipo: "canalon", familia: "ISOROOF", expectedSku: "CD100" },
    { tipo: "gotero_superior", familia: "ISODEC_PIR", expectedSku: "GSDECAM100" },
  ];

  for (const { tipo, familia, expectedSku } of expectedRoof100) {
    const resolved = resolveSKU_techo(tipo, familia, 100);
    assertEqual(resolved?.sku, expectedSku, `${familia} 100mm ${tipo} SKU`);
    assert(
      Number.isFinite(resolved?.web) && resolved.web > 0 && Number.isFinite(resolved?.costo) && resolved.costo > 0,
      `${familia} 100mm ${tipo} has usable web/costo`,
      resolved,
      "positive web/costo",
    );
  }
});

group("ISOFRIG wall quote — BOM and totals golden path", () => {
  resetPricingState();
  const result = calcParedCompleto({
    familia: "ISOFRIG_PIR",
    espesor: 100,
    alto: 3,
    perimetro: 10,
    numEsqExt: 4,
    numEsqInt: 0,
    aberturas: [{ ancho: 1, alto: 1, cant: 1 }],
    tipoEst: "metal",
    inclSell: false,
    incl5852: false,
    color: "Blanco",
  });

  assert(!result.error, "ISOFRIG_PIR 100mm quote succeeds", result.error, "no error");
  assertEqual(result.paneles.cantPaneles, 9, "ISOFRIG quote panel count");
  assertClose(result.paneles.areaNeta, 29.78, 0.001, "ISOFRIG quote net area subtracts openings");
  assertEqual(result.paneles.precioM2, 76.9454, "ISOFRIG quote uses web price by default");
  assertClose(result.paneles.costoPaneles, 2291.43, 0.01, "ISOFRIG quote panel subtotal");
  assertEqual(result.perfilesU.items.length, 2, "ISOFRIG quote includes base and crown U profiles");
  assert(result.perfilesU.items.every((item) => item.sku === "PU100MM"), "ISOFRIG 100mm U profile SKU in BOM", result.perfilesU.items, "PU100MM");
  assertClose(result.perfilesU.total, 121.2, 0.01, "ISOFRIG U profile subtotal");
  assertClose(result.totales.subtotalSinIVA, 2827.33, 0.01, "ISOFRIG quote subtotal sin IVA");
  assertClose(result.totales.totalFinal, 3449.34, 0.01, "ISOFRIG quote total con IVA");
});

resetPricingState();

console.log(`\n${failed === 0 ? "✓" : "✗"} pricingCatalogCoverage: ${passed} passed${failed ? `, ${failed} failed` : ""}`);
if (failed > 0) process.exit(1);
