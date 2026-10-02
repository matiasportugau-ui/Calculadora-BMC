/**
 * Regression: Admin row-create must not mint colliding MAN-* correlation ids.
 * Run: node tests/wolfboardManCorrelationId.test.js
 */
import assert from "node:assert/strict";
import { generateManCorrelationId } from "../server/routes/wolfboard.js";

const MAN_RE = /^MAN-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const a = generateManCorrelationId();
const b = generateManCorrelationId();
assert.match(a, MAN_RE, "MAN id is UUID-backed");
assert.match(b, MAN_RE, "second MAN id is UUID-backed");
assert.notEqual(a, b, "two sequential mints must differ");

const seen = new Set();
for (let i = 0; i < 500; i++) {
  const id = generateManCorrelationId();
  assert.match(id, MAN_RE);
  assert.equal(seen.has(id), false, `collision at i=${i}: ${id}`);
  seen.add(id);
}
assert.equal(seen.size, 500, "500 concurrent-style mints stay unique");

console.log("wolfboardManCorrelationId: ok");
