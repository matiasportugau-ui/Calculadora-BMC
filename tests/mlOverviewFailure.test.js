// Offline. node tests/mlOverviewFailure.test.js
import assert from "node:assert/strict";
import { mlOverviewFailure } from "../src/components/hub/ml/mlOverviewFailure.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("a healthy connector renders the dashboard", () => {
  assert.equal(mlOverviewFailure([null, null], { data: { ok: true } }), null);
});

check("a 401 is the operator session, not a Mercado Libre re-auth", () => {
  assert.equal(mlOverviewFailure([{ status: 401 }], { data: { ok: true } }), "session");
});

check("a failed connector status asks for re-auth", () => {
  assert.equal(mlOverviewFailure([], { data: { ok: false } }), "reauth");
});

check("a non-401 load error asks for re-auth", () => {
  assert.equal(mlOverviewFailure([{ status: 503 }], { data: { ok: true } }), "reauth");
});

console.log(`\nmlOverviewFailure: ${passed} passed`);
