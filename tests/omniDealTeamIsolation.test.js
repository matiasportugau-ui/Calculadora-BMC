// tests/omniDealTeamIsolation.test.js — deals must inherit conversation team isolation.
// Run: `node tests/omniDealTeamIsolation.test.js`.
import assert from "node:assert/strict";
import { listDeals } from "../server/lib/omni/deals/dealService.js";
import {
  appendDealTeamIsolationFilter,
  dealVisibleTo,
  isOmniAdmin,
} from "../server/lib/omni/teamIsolation.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DEAL_A = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const DEAL_B = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

check("isOmniAdmin recognizes admin/superadmin only", () => {
  assert.equal(isOmniAdmin({ role: "admin" }), true);
  assert.equal(isOmniAdmin({ role: "superadmin" }), true);
  assert.equal(isOmniAdmin({ role: "operator" }), false);
  assert.equal(isOmniAdmin({}), false);
});

check("appendDealTeamIsolationFilter: admin gets no filter", () => {
  const filters = [];
  const params = ["limit", "offset"];
  appendDealTeamIsolationFilter({ role: "admin", id: USER_A }, filters, params);
  assert.deepEqual(filters, []);
  assert.deepEqual(params, ["limit", "offset"]);
});

check("appendDealTeamIsolationFilter: operator scopes via source conversation team", () => {
  const filters = [];
  const params = ["limit", "offset"];
  appendDealTeamIsolationFilter({ role: "operator", id: USER_A }, filters, params);
  assert.deepEqual(params, ["limit", "offset", USER_A]);
  assert.equal(filters.length, 1);
  assert.match(filters[0], /d\.source_conversation_id IS NULL/);
  assert.match(filters[0], /omni_team_members WHERE user_id = \$3/);
});

await check("listDeals without user stays unscoped (trusted internal)", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listDeals(pool, { limit: 10 });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /omni_team_members/);
  assert.match(calls[0].sql, /LEFT JOIN omni_conversations c/);
});

await check("listDeals with operator appends team filter + joins conversations", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listDeals(pool, { limit: 10 }, { role: "operator", id: USER_A });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /LEFT JOIN omni_conversations c ON c\.id = d\.source_conversation_id/);
  assert.match(calls[0].sql, /omni_team_members/);
  assert.equal(calls[0].params[2], USER_A);
});

await check("dealVisibleTo: admin sees any existing deal", async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /SELECT 1 FROM omni_deals WHERE id = \$1/);
      assert.equal(params[0], DEAL_B);
      return { rowCount: 1 };
    },
  };
  assert.equal(await dealVisibleTo(pool, DEAL_B, { role: "admin", id: USER_A }), true);
});

await check("dealVisibleTo: operator denied for other team's deal", async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /LEFT JOIN omni_conversations/);
      assert.equal(params[0], DEAL_B);
      assert.equal(params[1], USER_A);
      // Simulate: deal B linked to team B — not in user A's membership subquery result.
      return { rowCount: 0 };
    },
  };
  assert.equal(
    await dealVisibleTo(pool, DEAL_B, { role: "operator", id: USER_A }),
    false,
  );
});

await check("dealVisibleTo: operator allowed for own-team deal", async () => {
  const pool = {
    async query(sql, params) {
      assert.equal(params[0], DEAL_A);
      assert.equal(params[1], USER_A);
      return { rowCount: 1 };
    },
  };
  assert.equal(
    await dealVisibleTo(pool, DEAL_A, { role: "operator", id: USER_A }),
    true,
  );
});

await check("dealVisibleTo: operator allowed for deal with no source conversation", async () => {
  // Predicate includes `d.source_conversation_id IS NULL` — pool returns a hit.
  const pool = {
    async query() {
      return { rowCount: 1 };
    },
  };
  assert.equal(
    await dealVisibleTo(pool, DEAL_A, { role: "operator", id: USER_A }),
    true,
  );
});

console.log(`\nomni deal team isolation: ${passed} checks passed`);
