/**
 * Ventas row fingerprint fail-closed gates.
 * Relocate-after-shift lives in tip saleState.test.js; open #1204 rewrites
 * that file and drops those pins. This file keeps the empty/header/non-array
 * guards that prevent wrong-row delete/estado after archive.
 * Run: node tests/ventasFingerprintGates.test.js
 */
import assert from "node:assert/strict";
import {
  findSheetRow1BasedByFingerprint,
  ventasRowIdentityFingerprint,
} from "../src/utils/logistica/saleState.js";

console.log("ventasFingerprintGates");

function rowWithIdentity({ orderId = "", nombre = "", tel = "", dir = "" } = {}) {
  const cells = Array(20).fill("");
  cells[2] = orderId;
  cells[8] = nombre;
  cells[9] = dir;
  cells[15] = tel;
  return cells;
}

{
  assert.equal(findSheetRow1BasedByFingerprint([], "", 4), null);
  assert.equal(findSheetRow1BasedByFingerprint([rowWithIdentity({ orderId: "1" })], "", 2), null);
  assert.equal(findSheetRow1BasedByFingerprint([rowWithIdentity({ orderId: "1" })], null, 2), null);
  console.log("  ✓ empty/null fingerprint never matches (no first-row delete)");
}

{
  const rows = [rowWithIdentity({ orderId: "100", nombre: "Ana", tel: "099", dir: "Pando" })];
  assert.equal(findSheetRow1BasedByFingerprint(null, "x", 2), null);
  assert.equal(findSheetRow1BasedByFingerprint({ 0: rows[0] }, "x", 2), null);
  console.log("  ✓ non-array dataRows → null");
}

{
  const target = rowWithIdentity({
    orderId: "100042",
    nombre: "Cliente X",
    tel: "099111222",
    dir: "Calle 1",
  });
  const rows = [target];
  const fp = ventasRowIdentityFingerprint(target);
  assert.equal(
    findSheetRow1BasedByFingerprint(rows, fp, 1),
    2,
    "hint row 1 is the header — ignore and scan from row 2",
  );
  assert.equal(findSheetRow1BasedByFingerprint(rows, fp, 0), 2);
  assert.equal(findSheetRow1BasedByFingerprint(rows, fp, Number.NaN), 2);
  console.log("  ✓ header/invalid hint is ignored; scan still finds the row");
}

{
  const blankFp = ventasRowIdentityFingerprint([]);
  assert.equal(blankFp, "\u0001\u0001\u0001", "empty cells join to four empty parts");
  const rows = [rowWithIdentity(), rowWithIdentity({ orderId: "9", nombre: "Z", tel: "9", dir: "Z" })];
  // Current: blank identity is truthy so it matches the first empty row.
  // Pin — do not "fix" to null here (would hide a real archive-row class).
  assert.equal(findSheetRow1BasedByFingerprint(rows, blankFp, 5), 2);
  console.log("  ✓ blank-row fingerprint matches first empty row (current; do not silently change)");
}

{
  const a = rowWithIdentity({ orderId: "1", nombre: "A", tel: "1", dir: "D" });
  const b = rowWithIdentity({ orderId: "1", nombre: "A", tel: "1", dir: "D" });
  b[5] = "[LOGISTICA:ENTREGADO]";
  assert.equal(
    ventasRowIdentityFingerprint(a),
    ventasRowIdentityFingerprint(b),
    "ESTADO GRAL (idx 5) must not be part of identity",
  );
  console.log("  ✓ fingerprint ignores estado column");
}

console.log("ventasFingerprintGates: ok");
