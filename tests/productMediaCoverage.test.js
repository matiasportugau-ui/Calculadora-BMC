/**
 * Coverage gates for product-media links.
 * Run: node tests/productMediaCoverage.test.js
 */
import {
  BORDER_OPTIONS,
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  HERRAMIENTAS,
  SELLADORES,
} from "../src/data/constants.js";
import {
  resolveBorderMedia,
  resolvePanelMedia,
  resolveAccessoryMedia,
} from "../src/data/product-media/productMediaResolve.js";

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

console.log("\n— borders 100%");
const borderIds = new Set();
for (const side of Object.keys(BORDER_OPTIONS || {})) {
  for (const o of BORDER_OPTIONS[side] || []) {
    if (o?.id && o.id !== "none") borderIds.add(o.id);
  }
}
for (const id of borderIds) {
  const m = resolveBorderMedia({ borderId: id, familia: "ISODEC" });
  ok(!!m.primaryImage, `border ${id} has image`);
  if (id.includes("babeta")) {
    ok(!/isowall/i.test(m.primaryImage || ""), `border ${id} not isowall`);
  }
}

console.log("\n— panels 100%");
const panels = { ...PANELS_TECHO, ...PANELS_PARED };
for (const fam of Object.keys(panels)) {
  const m = resolvePanelMedia({ familia: fam });
  ok(!!m.primaryImage, `panel ${fam} has image`);
}

console.log("\n— fijaciones ≥ 90%");
const fij = { ...FIJACIONES, ...(HERRAMIENTAS || {}) };
const fijKeys = Object.keys(fij);
let fijOk = 0;
for (const key of fijKeys) {
  const m = resolveAccessoryMedia({ kind: "fijacion", key });
  if (m.primaryImage) fijOk++;
}
const fijPct = fijKeys.length ? fijOk / fijKeys.length : 1;
ok(fijPct >= 0.9, `fij coverage ${fijOk}/${fijKeys.length} (${Math.round(fijPct * 100)}%) ≥ 90%`);

console.log("\n— selladores 100%");
for (const key of Object.keys(SELLADORES || {})) {
  const m = resolveAccessoryMedia({ kind: "sellador", key });
  ok(!!m.primaryImage, `sell ${key} has image`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
