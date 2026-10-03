/**
 * Regression: CRM cotización create must not mint colliding COT-* ids.
 * Run: node tests/cotizacionId.test.js
 */
import assert from "node:assert/strict";
import { generateCotizacionId } from "../server/routes/bmcDashboard.js";

const COT_RE = /^COT-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const a = generateCotizacionId();
const b = generateCotizacionId();
assert.match(a, COT_RE, "COT id is UUID-backed");
assert.match(b, COT_RE, "second COT id is UUID-backed");
assert.notEqual(a, b, "two sequential mints must differ");

const seen = new Set();
for (let i = 0; i < 500; i++) {
  const id = generateCotizacionId();
  assert.match(id, COT_RE);
  assert.equal(seen.has(id), false, `collision at i=${i}: ${id}`);
  seen.add(id);
}
assert.equal(seen.size, 500, "500 concurrent-style mints stay unique");

console.log("cotizacionId.test.js: ok");
