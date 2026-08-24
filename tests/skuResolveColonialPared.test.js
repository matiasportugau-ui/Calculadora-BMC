/**
 * SKU resolution: ISOROOF_COLONIAL remaps non-cumbrera profiles to ISOROOF,
 * but keeps the colonial-specific cumbrera. Wall profiles fall back to tipo._all
 * (esquineros, K2, PA5852). Complements MATRIZ path mapping (#1091) at the BOM layer.
 * Run: node tests/skuResolveColonialPared.test.js
 */
import {
  resolveSKU_techo,
  resolveSKU_techoByRange,
  resolvePerfilPared,
} from "../src/utils/calculations.js";

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

function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

group("ISOROOF_COLONIAL cumbrera stays colonial (not CUMROOF3M)", () => {
  const col = resolveSKU_techo("cumbrera", "ISOROOF_COLONIAL", 40);
  const std = resolveSKU_techo("cumbrera", "ISOROOF", 40);
  assert(col?.sku === "CUMROOFCOL", "colonial cumbrera → CUMROOFCOL");
  assert(std?.sku === "CUMROOF3M", "ISOROOF cumbrera → CUMROOF3M");
  assert(col?.sku !== std?.sku, "colonial and 3G cumbrera SKUs differ");
  assert(col?.largo === 2.2, "colonial cumbrera bar 2.2 m");
});

group("ISOROOF_COLONIAL non-cumbrera remaps to ISOROOF profiles", () => {
  const g50 = resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL", 50);
  const g50std = resolveSKU_techo("gotero_frontal", "ISOROOF", 50);
  assert(g50?.sku === "GFS50", "colonial 50 mm gotero → GFS50");
  assert(g50?.sku === g50std?.sku, "colonial gotero SKU equals ISOROOF gotero");

  const g40exact = resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL", 40);
  assert(g40exact === null, "exact 40 mm colonial gotero is null (no 40 / no _all)");

  const g40range = resolveSKU_techoByRange("gotero_frontal", "ISOROOF_COLONIAL", 40);
  assert(g40range?.sku === "GFS30", "range 40 mm colonial gotero → closest ≤40 GFS30");

  const unknown = resolveSKU_techo("no_existe", "ISOROOF_COLONIAL", 40);
  assert(unknown === null, "unknown tipo → null");
});

group("resolvePerfilPared tipo._all (esquineros / K2 / PA5852)", () => {
  const extNull = resolvePerfilPared("esquinero_ext", null, null);
  assert(extNull?.sku === "ESQ-EXT", "esquinero_ext null familia → ESQ-EXT");

  const extFam = resolvePerfilPared("esquinero_ext", "ISOPANEL", 100);
  assert(extFam?.sku === "ESQ-EXT", "esquinero_ext + familia still tipo._all");

  const k2 = resolvePerfilPared("perfil_k2", "ISOWALL", 80);
  assert(k2?.sku === "K2", "perfil_k2 any familia → K2");

  const alu = resolvePerfilPared("perfil_5852", "ISOPANEL", 50);
  assert(alu?.sku === "PA5852", "perfil_5852 → PA5852 (not PLECHU98)");
  assert(alu?.largo === 6.8, "PA5852 bar 6.8 m");
});

group("resolvePerfilPared exact thickness vs missing", () => {
  const u100 = resolvePerfilPared("perfil_u", "ISOPANEL", 100);
  assert(u100?.sku === "PU100MM", "perfil_u ISOPANEL 100 → PU100MM");

  const missing = resolvePerfilPared("perfil_u", "ISOPANEL", 90);
  assert(missing === null, "perfil_u 90 mm without _all → null");

  const noTipo = resolvePerfilPared("no_existe", "ISOPANEL", 100);
  assert(noTipo === null, "unknown pared tipo → null");
});

console.log(`\nskuResolveColonialPared: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
