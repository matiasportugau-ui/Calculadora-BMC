/**
 * packagePhysicalDims / accessory footprint
 * Run: node tests/packageDims.test.js
 */
import assert from "node:assert/strict";
import {
  packagePhysicalDims,
  formatPackageDimsLabel,
  packageRowYOffset,
} from "../src/utils/logistica/packageDims.js";
import { buildAccessoryPkgs, ROW_W } from "../src/utils/logistica/cargoPacking.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("packageDims");

{
  const panel = { kind: "panel", tipo: "ISODEC", len: 7, h: 0.36 };
  const d = packagePhysicalDims(panel);
  assert.equal(d.W, ROW_W);
  assert.equal(d.L, 7);
  assert.equal(d.isAccessory, false);
  ok("panel uses ROW_W");
}

{
  const acc = { kind: "accessory", tipo: "ACCESORIOS", len: 7, h: 0.25, width: 0.3 };
  const d = packagePhysicalDims(acc);
  assert.equal(d.W, 0.3);
  assert.equal(d.L, 7);
  assert.equal(d.H, 0.25);
  assert.ok(Math.abs(d.volumeM3 - 0.525) < 1e-9);
  assert.match(formatPackageDimsLabel(acc, { includeVol: true }), /7\.00m × 30cm × 25cm/);
  ok("accessory uses real width not 1.2m");
}

{
  const stop = {
    id: "s1",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 7, cantidad: 3 }],
    accesorios: [{ id: "a1", descr: "tornillos", cantidad: 1 }],
    // sticky default 3 without manual — must not win
    accPackage: { enabled: true, longitud: 3, ancho: 0.3, alto: 0.2, foamMm: 50, manualDims: false },
  };
  const [pkg] = buildAccessoryPkgs(stop);
  assert.equal(pkg.len, 7, "tracks longest panel when not manual");
  assert.equal(pkg.width, 0.3);
  assert.equal(pkg.h, 0.25);
  const y = packageRowYOffset({ ...pkg, row: 0 });
  assert.ok(Math.abs(y - (ROW_W - 0.3) / 2) < 1e-9, "centered in row");
  ok("buildAccessoryPkgs ignores sticky 3m default");
}

{
  const stop = {
    id: "s2",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 7, cantidad: 1 }],
    accesorios: [{ id: "a1", descr: "perfil", cantidad: 1 }],
    accPackage: { enabled: true, longitud: 4.5, ancho: 0.22, alto: 0.14, foamMm: 50, manualDims: true },
  };
  const [pkg] = buildAccessoryPkgs(stop);
  assert.equal(pkg.len, 4.5);
  ok("manualDims respects operator length");
}

console.log(`\n${passed} assertions ok`);
