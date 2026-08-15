/**
 * flattenPerfilesLibre _all / tipo-level SKU rows (#1038).
 * Regression: 5852 / K2 / esquineros vanished from the Agregar producto index
 * and presupuesto-libre billing when the walker skipped sku-at-_all nodes.
 * Run: node tests/flattenPerfilesLibre.test.js
 */
import { flattenPerfilesLibre, computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";
import { PERFIL_PARED } from "../src/data/constants.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const syntheticTecho = {
  cumbrera_flat: { sku: "CUM-1", venta: 10, web: 12, largo: 3, label: "Cumbrera flat" },
  gotero: {
    _all: { sku: "GOT-ALL", venta: 5, web: 6, largo: 3, label: "Gotero all" },
  },
  canal: {
    ISOROOF: {
      100: { sku: "CAN-100", venta: 8, web: 9, largo: 3 },
    },
  },
  ghost: { _all: { venta: 1, web: 1, label: "Sin SKU" } },
};

const rows = flattenPerfilesLibre(syntheticTecho, {});
const byId = new Map(rows.map((r) => [r.id, r]));

assert(byId.has("pt:cumbrera_flat:_all:_all"), "tipo-level sku → pt:tipo:_all:_all");
assert(byId.get("pt:cumbrera_flat:_all:_all")?.sku === "CUM-1", "tipo-level keeps sku");
assert(byId.has("pt:gotero:_all:_all"), "fam _all sku → pt:tipo:_all:_all");
assert(byId.get("pt:gotero:_all:_all")?.sku === "GOT-ALL", "fam _all keeps sku");
assert(byId.has("pt:canal:ISOROOF:100"), "nested esp keeps pt:tipo:fam:esp");
assert(!rows.some((r) => r.label.includes("Sin SKU") || r.id.includes("ghost")), "rows without sku are skipped");

const billed = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePerfilQty: { "pt:gotero:_all:_all": 3 },
  perfilCatalogById: byId,
});
const perfilGroup = billed.libreGroups.find((g) => g.title === "PERFILERÍA");
assert(perfilGroup?.items?.length === 1, "engine bills the _all perfil");
assert(perfilGroup?.items?.[0]?.sku === "GOT-ALL", "billed sku is GOT-ALL");
assert(perfilGroup?.items?.[0]?.total === 18, "3 × web 6 = 18");

const paredRows = flattenPerfilesLibre({}, PERFIL_PARED);
const pa5852 = paredRows.find((r) => r.sku === "PA5852");
assert(!!pa5852, "real PERFIL_PARED includes PA5852");
assert(pa5852?.id === "pp:perfil_5852:_all:_all", "PA5852 id is pp:perfil_5852:_all:_all");
assert(pa5852?.venta === 64.19 && pa5852?.web === 64.19, "PA5852 list price 64.19");
assert(pa5852?.largo === 6.8, "PA5852 bar length 6.8 m");

const k2 = paredRows.find((r) => r.sku === "K2");
const esq = paredRows.find((r) => r.sku === "ESQ-EXT");
assert(!!k2 && k2.id === "pp:perfil_k2:_all:_all", "K2 _all row is flattened");
assert(!!esq && esq.id === "pp:esquinero_ext:_all:_all", "esquinero _all row is flattened");

const money = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  librePerfilQty: { [pa5852.id]: 2 },
  perfilCatalogById: new Map(paredRows.map((r) => [r.id, r])),
});
const moneyRow = money.libreGroups.find((g) => g.title === "PERFILERÍA")?.items?.[0];
assert(moneyRow?.sku === "PA5852", "engine bills PA5852");
assert(moneyRow?.total === 128.38, "2 × 64.19 = 128.38");

console.log(`\nflattenPerfilesLibre: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
