/**
 * Tests para src/utils/productCatalogIndex.js — el índice unificado que alimenta
 * el buscador del drawer "Agregar producto".
 * Cubre: unión de los 4 tipos de catálogo, integridad de addBy+key/familia,
 * override de catálogo, y el hint de precio por lista activa.
 * Run: node tests/productCatalogIndex.test.js
 */

import { buildProductCatalogIndex, rowPriceHint } from "../src/utils/productCatalogIndex.js";
import {
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  HERRAMIENTAS,
  SELLADORES,
} from "../src/data/constants.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

const index = buildProductCatalogIndex();
const byKind = (k) => index.filter((r) => r.kind === k);

/* ── Cobertura: los 4 tipos están presentes ──────────────────────────────── */
group("cobertura de catálogos", () => {
  assert(byKind("panel").length > 0, "incluye paneles");
  assert(byKind("perfil").length > 0, "incluye perfilería");
  assert(byKind("fijacion").length > 0, "incluye fijaciones/herramientas");
  assert(byKind("sellador").length > 0, "incluye selladores");

  // Paneles: una fila por espesor de cada familia (techo + pared).
  const espCount = [...Object.values(PANELS_TECHO), ...Object.values(PANELS_PARED)]
    .reduce((n, p) => n + Object.keys(p.esp || {}).length, 0);
  assert(byKind("panel").length === espCount, `paneles = 1 fila por espesor (${espCount})`);

  // Fijaciones = FIJACIONES + HERRAMIENTAS (ambas van a libreFijQty).
  const fijCount = Object.keys(FIJACIONES).length + Object.keys(HERRAMIENTAS).length;
  assert(byKind("fijacion").length === fijCount, `fijaciones = FIJACIONES + HERRAMIENTAS (${fijCount})`);

  assert(byKind("sellador").length === Object.keys(SELLADORES).length, "selladores = |SELLADORES|");
});

/* ── Integridad de addBy + key/familia por tipo ──────────────────────────── */
group("cada fila tiene destino de alta válido", () => {
  const ADD_BY = { panel: "panelLine", perfil: "perfilQty", fijacion: "fijQty", sellador: "sellQty" };
  let ok = true;
  for (const r of index) {
    if (r.addBy !== ADD_BY[r.kind]) { ok = false; console.error(`    addBy inválido en ${r.id}: ${r.addBy}`); break; }
    if (r.kind === "panel") {
      if (!r.familia || !Number.isFinite(r.espesor)) { ok = false; console.error(`    panel sin familia/espesor: ${r.id}`); break; }
    } else if (!r.key) { ok = false; console.error(`    fila sin key: ${r.id}`); break; }
    if (!r.label || !r.searchText || !r.category) { ok = false; console.error(`    fila incompleta: ${r.id}`); break; }
  }
  assert(ok, "todas las filas: addBy correcto + key/familia + label/searchText/category");

  // Ids únicos (React key safety).
  const ids = new Set(index.map((r) => r.id));
  assert(ids.size === index.length, "ids únicos");
});

/* ── Las keys resuelven contra los mapas de estado reales ────────────────── */
group("keys apuntan a slugs/ids existentes", () => {
  const fijSlugs = new Set([...Object.keys(FIJACIONES), ...Object.keys(HERRAMIENTAS)]);
  assert(byKind("fijacion").every((r) => fijSlugs.has(r.key)), "keys de fijación ∈ FIJACIONES∪HERRAMIENTAS");
  const sellSlugs = new Set(Object.keys(SELLADORES));
  assert(byKind("sellador").every((r) => sellSlugs.has(r.key)), "keys de sellador ∈ SELLADORES");
  // Perfil ids usan el esquema estable pt:/pp:.
  assert(byKind("perfil").every((r) => /^p[tp]:/.test(r.key)), "keys de perfil con prefijo pt:/pp:");
  // Familia de panel ∈ PANELS_TECHO∪PANELS_PARED.
  const famSet = new Set([...Object.keys(PANELS_TECHO), ...Object.keys(PANELS_PARED)]);
  assert(byKind("panel").every((r) => famSet.has(r.familia)), "familia de panel ∈ PANELS_*");
});

/* ── Búsqueda por nombre y SKU ────────────────────────────────────────────── */
group("searchText permite filtrar por nombre y SKU", () => {
  const q = "silicona";
  const hits = index.filter((r) => r.searchText.includes(q));
  assert(hits.length > 0 && hits.some((r) => r.kind === "sellador"), 'buscar "silicona" encuentra selladores');
  // Un SKU de panel (familia-espesor) debe ser buscable.
  const somePanel = byKind("panel")[0];
  assert(index.some((r) => r.searchText.includes(somePanel.sku.toLowerCase())), "SKU de panel es buscable");
});

/* ── Override de catálogo ─────────────────────────────────────────────────── */
group("acepta override de catálogo", () => {
  const custom = buildProductCatalogIndex({
    catalog: { SELLADORES: { mi_sellador: { label: "Sellador X", venta: 9, web: 10, unidad: "unid" } } },
  });
  const sells = custom.filter((r) => r.kind === "sellador");
  assert(sells.length === 1 && sells[0].key === "mi_sellador", "usa SELLADORES override");
  // Los demás catálogos caen a defaults.
  assert(custom.some((r) => r.kind === "panel"), "otros catálogos usan defaults");
});

/* ── rowPriceHint respeta lista activa con fallback ──────────────────────── */
group("rowPriceHint", () => {
  const row = { venta: 5, web: 7 };
  assert(rowPriceHint(row, "venta") === 5, "venta → 5");
  assert(rowPriceHint(row, "web") === 7, "web → 7");
  assert(rowPriceHint({ web: 7 }, "venta") === 7, "venta ausente → fallback web");
  assert(rowPriceHint({ venta: 5 }, "web") === 5, "web ausente → fallback venta");
  assert(rowPriceHint(null) === 0, "null → 0");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
