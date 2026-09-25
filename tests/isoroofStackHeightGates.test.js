/**
 * IsoRoof stack height — odd counts are the only case that differs from a plain stack.
 * An even count of 100 mm panels is 0.24 m either way, so fleteEngine's pair check
 * still passes if the nervio remainder is deleted. That drops a leftover panel by 2 cm
 * and can change whether a fila exceeds 2.4 m (freight USD).
 *
 * Run: node tests/isoroofStackHeightGates.test.js
 */
import assert from "node:assert/strict";
import { packageHeightM } from "../src/utils/logistica/cargoPacking.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("isoroofStackHeightGates");

{
  assert.equal(packageHeightM("ISOROOF_3G", 100, 2), 0.24);
  assert.equal(packageHeightM("ISODEC", 100, 2), 0.24);
  ok("even 100 mm pair is 0.24 m for IsoRoof and IsoDec (does not prove nervio)");
}

{
  assert.equal(packageHeightM("ISOROOF_3G", 100, 1), 0.14);
  assert.equal(packageHeightM("ISODEC", 100, 1), 0.12);
  assert.equal(packageHeightM("isoroof", 50, 1), 0.09);
  ok("odd IsoRoof keeps the nervio on the leftover panel");
}

{
  assert.equal(packageHeightM("ISOROOF_3G", 100, 3), 0.38);
  assert.equal(packageHeightM("ISODEC", 100, 3), 0.36);
  ok("three IsoRoof panels are one pair plus a nervio remainder");
}

{
  assert.equal(packageHeightM("ISOROOF_3G", 100, 2.9), 0.24);
  assert.equal(packageHeightM("ISOROOF_3G", 100, 0), 0);
  assert.equal(packageHeightM("ISOROOF_3G", 100, -2), 0);
  assert.equal(packageHeightM("ISOROOF", 100, "x"), 0);
  ok("fractional count floors; zero, negative, and non-numeric count bill 0");
}

{
  assert.equal(packageHeightM("ISOROOF_3G", -100, 1), 0.04);
  assert.equal(packageHeightM("ISODEC", -100, 1), 0.02);
  ok("negative thickness clamps to 0; odd IsoRoof is nervio only");
}

{
  assert.equal(packageHeightM("ISO ROOF", 100, 1), 0.12);
  assert.equal(packageHeightM(null, 100, 1), 0.12);
  ok("spaced or empty tipo is not IsoRoof");
}

console.log(`isoroofStackHeightGates: ${passed} passed`);
