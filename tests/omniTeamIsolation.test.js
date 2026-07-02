// tests/omniTeamIsolation.test.js — standalone (no deps, no DB) unit test for
// the shared team-isolation SQL-fragment builder. Run: `node tests/omniTeamIsolation.test.js`.
import assert from "node:assert/strict";
import { appendTeamIsolationFilter } from "../server/lib/omni/teamIsolation.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("admin role: no filter, no param appended", () => {
  const filters = ["c.status = 'open'"];
  const params = ["existing"];
  appendTeamIsolationFilter({ role: "admin", id: "u1" }, filters, params);
  assert.deepEqual(filters, ["c.status = 'open'"]);
  assert.deepEqual(params, ["existing"]);
});

check("superadmin role: no filter, no param appended", () => {
  const filters = [];
  const params = [];
  appendTeamIsolationFilter({ role: "superadmin", id: "u1" }, filters, params);
  assert.deepEqual(filters, []);
  assert.deepEqual(params, []);
});

check("operator role: appends filter + param, uses correct positional placeholder", () => {
  const filters = ["c.status = 'open'"];
  const params = ["existing"]; // one param already present → new one is $2
  appendTeamIsolationFilter({ role: "operator", id: "u2" }, filters, params);
  assert.deepEqual(params, ["existing", "u2"]);
  assert.equal(filters.length, 2);
  assert.match(filters[1], /\$2::uuid/);
  assert.match(filters[1], /c\.team_id IS NULL/);
  assert.match(filters[1], /omni_team_members WHERE user_id = \$2/);
});

check("missing/undefined role: treated as non-admin (filter applied)", () => {
  const filters = [];
  const params = [];
  appendTeamIsolationFilter({ id: "u3" }, filters, params);
  assert.equal(filters.length, 1);
  assert.deepEqual(params, ["u3"]);
});

console.log(`\n✅ omniTeamIsolation: ${passed} checks OK`);
