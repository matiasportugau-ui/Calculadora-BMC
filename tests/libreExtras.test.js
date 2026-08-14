/**
 * Extraordinarios: title vs description, confirm stack, legacy hydrate.
 * Run: node tests/libreExtras.test.js
 */
import {
  CUSTOM_PRODUCTS_STORAGE_KEY,
  hydrateLibreExtras,
  extrasToEngineItems,
  normalizeLibreExtra,
  extraToEngineItem,
  loadSavedCustomProducts,
  saveCustomProductLocal,
} from "../src/utils/libreExtras.js";
import { computePresupuestoLibreCatalogo } from "../src/utils/presupuestoLibreCatalogo.js";
import { serializeProject, deserializeProject } from "../src/utils/projectFile.js";

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

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
assert(items[0].label === "A" && items[0].note === "nota" && items[0].total === 20, "title/note/total");

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
assert(g && g.items.length === 2 && g.items[0].label === "Andamio" && g.items[1].total === 36, "engine two extras");

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

const fromExtrasKey = hydrateLibreExtras({
  extras: [{ label: "Andamio", pu: "80,5", cant: "2" }],
});
assert(fromExtrasKey.length === 1 && fromExtrasKey[0].titulo === "Andamio", "hydrate extras[] alias");
const comma = extraToEngineItem(fromExtrasKey[0]);
assert(comma && comma.total === 161, "comma decimal 80,5 × 2");

const descOnly = extraToEngineItem({ descripcion: "Flete interno", precio: "40" });
assert(descOnly && descOnly.label === "Flete interno" && descOnly.note === "", "description-only label");

const noCant = extraToEngineItem({ titulo: "Global", precio: "10" });
assert(noCant && noCant.cant === 1 && noCant.total === 10, "missing cantidad defaults to 1");

const neg = extraToEngineItem({ titulo: "Bad", precio: "-5", cantidad: "2" });
assert(neg && neg.pu === 0 && neg.total === 0, "negative precio does not bill");

assert(normalizeLibreExtra(null) === null, "null extra dropped");
assert(normalizeLibreExtra("x") === null, "non-object extra dropped");

localStorage.clear();
assert(loadSavedCustomProducts().length === 0, "empty store");
localStorage.setItem(CUSTOM_PRODUCTS_STORAGE_KEY, "{not-json");
assert(loadSavedCustomProducts().length === 0, "invalid JSON → []");
localStorage.setItem(CUSTOM_PRODUCTS_STORAGE_KEY, JSON.stringify({ titulo: "nope" }));
assert(loadSavedCustomProducts().length === 0, "non-array → []");

localStorage.clear();
assert(saveCustomProductLocal({ descripcion: "sin titulo", precio: "1" }).length === 0, "save without titulo ignored");
const saved = saveCustomProductLocal({ titulo: "Andamio", precio: "80", cantidad: "1" });
assert(saved.length === 1 && saved[0].titulo === "Andamio", "save first custom product");
const deduped = saveCustomProductLocal({ titulo: "ANDAMIO", precio: "90" });
assert(deduped.length === 1 && deduped[0].precio === "90", "save dedupes title case-insensitive");

const extrasRoundtrip = [
  { titulo: "Andamio", descripcion: "semana", precio: "80", cantidad: "1", unidades: "sem" },
];
const blob = serializeProject({
  scenario: "presupuesto_libre",
  listaPrecios: "web",
  proyecto: { nombre: "QA extras" },
  techo: {},
  pared: {},
  camara: {},
  flete: 0,
  overrides: {},
  excludedItems: {},
  categoriasActivas: {},
  libreExtras: extrasRoundtrip,
});
assert(Array.isArray(blob.libreExtras) && blob.libreExtras[0].titulo === "Andamio", "serialize keeps libreExtras");
const restored = deserializeProject(blob);
assert(Array.isArray(restored.libreExtras) && restored.libreExtras[0].descripcion === "semana", "deserialize libreExtras");
const emptySer = serializeProject({
  scenario: "solo_techo",
  listaPrecios: "web",
  proyecto: {},
  techo: {},
  pared: {},
  camara: {},
  flete: 0,
  overrides: {},
  excludedItems: {},
  categoriasActivas: {},
  libreExtras: [],
});
assert(emptySer.libreExtras === undefined, "empty extras omitted from project file");

console.log(`\nlibreExtras: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
