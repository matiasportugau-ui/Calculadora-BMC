/**
 * Extraordinarios: title vs description, confirm stack, legacy hydrate.
 * Run: node tests/libreExtras.test.js
 */
import {
  hydrateLibreExtras,
  extrasToEngineItems,
  normalizeLibreExtra,
  extraToEngineItem,
} from "../src/utils/libreExtras.js";
import { computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";

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

const legacy = hydrateLibreExtras({
  libreExtra: { texto: "Mano de obra", precio: "250", unidades: "global", cantidad: "1" },
});
assert(legacy.length === 1 && legacy[0].titulo === "Mano de obra", "hydrate legacy texto");

const list = hydrateLibreExtras({
  libreExtra: { texto: "old" },
  libreExtras: [
    { titulo: "A", descripcion: "nota", precio: "10", cantidad: "2", unidades: "unid" },
    { titulo: "B", precio: "5", cantidad: "1" },
  ],
});
assert(list.length === 2 && list[0].titulo === "A", "prefer libreExtras array");
const items = extrasToEngineItems(list);
assert(
  items[0].label === "A — nota" && items[0].note === "nota" && items[0].total === 20,
  "title+description folded into BOM label",
);

const r = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [],
  librePerfilQty: {},
  perfilCatalogById: new Map(),
  libreFijQty: {},
  libreSellQty: {},
  flete: 0,
  libreExtras: [
    { titulo: "Andamio", descripcion: "alquiler semanal", precio: "80", cantidad: "1", unidades: "sem" },
    { titulo: "Sellador extra", precio: "12", cantidad: "3", unidades: "tubo" },
  ],
});
const g = r.libreGroups.find((x) => x.title === "EXTRAORDINARIOS");
assert(
  g && g.items.length === 2 && g.items[0].label === "Andamio — alquiler semanal" && g.items[1].total === 36,
  "engine two extras; description reaches BOM label",
);

const r2 = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  libreExtra: { texto: "Mano de obra montaje", precio: "250", unidades: "global", cantidad: "1" },
});
const g2 = r2.libreGroups.find((x) => x.title === "EXTRAORDINARIOS");
assert(g2?.items[0]?.label === "Mano de obra montaje" && g2.items[0].total === 250, "legacy object still computes");

assert(normalizeLibreExtra({ titulo: "", descripcion: "", precio: "", unidades: "", cantidad: "" }) === null, "empty draft dropped");
assert(!!extraToEngineItem({ titulo: "X" }), "title-only extra ok");

const alias = extraToEngineItem({ label: "Andamio", pu: "80", cant: "2" });
assert(alias && alias.label === "Andamio" && alias.total === 160, "agent alias label/pu/cant");

console.log(`\nlibreExtras: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
