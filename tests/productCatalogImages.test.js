/**
 * Visual identity for Agregar Producto — every row must resolve a group.
 * Run: node tests/productCatalogImages.test.js
 */
import {
  resolveProductVisual,
  visualGroupFor,
  shortCodeFor,
  splitProductLabel,
} from "../src/utils/productCatalogImages.js";
import { buildProductCatalogIndex } from "../src/utils/productCatalogIndex.js";

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log("  ✓", msg);
  } else {
    failed++;
    console.error("  ✗", msg);
  }
}

const index = buildProductCatalogIndex();

console.log("\n— full catalog coverage");
ok(index.length >= 100, `index has ${index.length} rows`);

let missingGroup = 0;
let panelsWithoutSrc = 0;
let withoutCode = 0;
const groups = new Set();

let visualBad = 0;
for (const row of index) {
  const v = resolveProductVisual(row);
  if (!v.group) missingGroup++;
  groups.add(v.group);
  if (!v.shortCode) withoutCode++;
  if (row.kind === "panel" && !v.src) panelsWithoutSrc++;
  if (typeof v.fit !== "string" || !v.tone) visualBad++;
}

console.log("\n— summary");
ok(missingGroup === 0, `no missing groups (${missingGroup})`);
ok(withoutCode === 0, `all have shortCode (${withoutCode} missing)`);
ok(panelsWithoutSrc === 0, `all panels have src (${panelsWithoutSrc} missing)`);
ok(groups.size >= 8, `distinct groups >= 8 (got ${groups.size})`);
ok(visualBad === 0, `all rows have fit+tone (${visualBad} bad)`);

console.log("\n— typed groups for accessories");
const tornillo = index.find((r) => (r.key || r.id || "") === "tornillo_t1" || /fij:tornillo_t1/.test(r.id || ""));
ok(!!tornillo && visualGroupFor(tornillo) === "tornillo", "tornillo_t1 → tornillo");
const anclaje = index.find((r) => (r.key || "") === "anclaje_h" || /fij:anclaje_h$/.test(r.id || ""));
ok(!!anclaje && visualGroupFor(anclaje) === "anclaje", `anclaje_h → anclaje (got ${anclaje ? visualGroupFor(anclaje) : "missing"})`);
const sell = index.find((r) => /silicona/.test(r.id || ""));
ok(!!sell && visualGroupFor(sell) === "silicona", "silicona → silicona");

console.log("\n— perfiles not all same fake photo");
const perfiles = index.filter((r) => r.kind === "perfil");
const babeta = perfiles.find((r) => /babeta/i.test(r.label));
const u = perfiles.find((r) => /perfil u/i.test(r.label));
const gotero = perfiles.find((r) => /gotero/i.test(r.label));
if (babeta) ok(resolveProductVisual(babeta).group === "babeta", "babeta group");
if (u) {
  ok(resolveProductVisual(u).group === "perfil_u", "perfil u group");
  ok(resolveProductVisual(u).src == null, "perfil u uses stage not shared stock");
}
if (gotero) ok(resolveProductVisual(gotero).group === "gotero", "gotero group");

console.log("\n— label split");
const long = index.find((r) => (r.label || "").includes("·"));
if (long) {
  const { primary, secondary } = splitProductLabel(long);
  ok(primary.length > 0, "primary non-empty");
  ok(primary.length < long.label.length || secondary.length > 0, "split reduces primary or adds secondary");
}

console.log("\n— shortCode prefers sku");
const withSku = index.find((r) => r.sku);
if (withSku) {
  ok(shortCodeFor(withSku).length > 0, "shortCode non-empty");
}

console.log("\n— resolveProductVisual stability");
const sample = index[0];
const a = resolveProductVisual(sample);
const b = resolveProductVisual(sample);
ok(a.group === b.group && a.shortCode === b.shortCode, "deterministic visual");
ok(typeof a.tone === "string" && a.tone.startsWith("#"), "tone is hex");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
