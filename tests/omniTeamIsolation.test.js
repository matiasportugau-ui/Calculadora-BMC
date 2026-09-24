// tests/omniTeamIsolation.test.js — standalone (no deps, no DB) unit test for
// the shared team-isolation SQL-fragment builder + team_id write-gate.
// Run: `node tests/omniTeamIsolation.test.js`.
import assert from "node:assert/strict";
import {
  appendTeamIsolationFilter,
  authorizeConversationTeamAssignment,
  isOmniAdmin,
} from "../server/lib/omni/teamIsolation.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}
async function checkAsync(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check("isOmniAdmin recognizes admin/superadmin only", () => {
  assert.equal(isOmniAdmin({ role: "admin" }), true);
  assert.equal(isOmniAdmin({ role: "superadmin" }), true);
  assert.equal(isOmniAdmin({ role: "operator" }), false);
  assert.equal(isOmniAdmin({}), false);
});

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

await checkAsync("authorize team_id: undefined (not in patch) always ok", async () => {
  const r = await authorizeConversationTeamAssignment({}, { role: "operator", id: "u1" }, undefined);
  assert.deepEqual(r, { ok: true });
});

await checkAsync("authorize team_id: admin may clear or set any team without DB", async () => {
  const cleared = await authorizeConversationTeamAssignment({}, { role: "admin", id: "u1" }, null);
  assert.deepEqual(cleared, { ok: true });
  const set = await authorizeConversationTeamAssignment(
    {},
    { role: "superadmin", id: "u1" },
    "11111111-1111-1111-1111-111111111111",
  );
  assert.deepEqual(set, { ok: true });
});

await checkAsync("authorize team_id: operator cannot clear to shared pool", async () => {
  const r = await authorizeConversationTeamAssignment({}, { role: "operator", id: "u1" }, null);
  assert.equal(r.ok, false);
  assert.equal(r.error, "team_clear_forbidden");
  assert.equal(r.status, 403);
});

await checkAsync("authorize team_id: operator must be a member of target team", async () => {
  const TEAM = "22222222-2222-2222-2222-222222222222";
  const USER = "33333333-3333-3333-3333-333333333333";
  const poolMember = {
    async query(sql, params) {
      assert.match(sql, /omni_team_members/);
      assert.deepEqual(params, [TEAM, USER]);
      return { rowCount: 1 };
    },
  };
  const ok = await authorizeConversationTeamAssignment(
    poolMember,
    { role: "operator", id: USER },
    TEAM,
  );
  assert.deepEqual(ok, { ok: true });

  const poolOutsider = {
    async query() {
      return { rowCount: 0 };
    },
  };
  const denied = await authorizeConversationTeamAssignment(
    poolOutsider,
    { role: "operator", id: USER },
    TEAM,
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "team_membership_required");
  assert.equal(denied.status, 403);
});

await checkAsync("authorize team_id: membership lookup failure is fail-closed 503", async () => {
  const poolBoom = {
    async query() {
      throw new Error("db down");
    },
  };
  const r = await authorizeConversationTeamAssignment(
    poolBoom,
    { role: "operator", id: "u1" },
    "22222222-2222-2222-2222-222222222222",
  );
  assert.equal(r.ok, false);
  assert.equal(r.error, "team_membership_check_failed");
  assert.equal(r.status, 503);
});

console.log(`\n✅ omniTeamIsolation: ${passed} checks OK`);
