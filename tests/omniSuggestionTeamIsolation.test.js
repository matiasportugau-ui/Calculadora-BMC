// tests/omniSuggestionTeamIsolation.test.js — HITL suggestions must inherit
// conversation team isolation (list + accept/reject visibility).
// Run: `node tests/omniSuggestionTeamIsolation.test.js`.
import assert from "node:assert/strict";
import { listSuggestions } from "../server/lib/omni/orchestrator/suggestions.js";
import { isOmniAdmin, suggestionVisibleTo } from "../server/lib/omni/teamIsolation.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SUG_A = "ssssssss-ssss-ssss-ssss-ssssssssssss";
const SUG_B = "tttttttt-tttt-tttt-tttt-tttttttttttt";

check("isOmniAdmin recognizes admin/superadmin only", () => {
  assert.equal(isOmniAdmin({ role: "admin" }), true);
  assert.equal(isOmniAdmin({ role: "superadmin" }), true);
  assert.equal(isOmniAdmin({ role: "operator" }), false);
  assert.equal(isOmniAdmin({}), false);
});

await check("listSuggestions without user stays unscoped (trusted internal)", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listSuggestions(pool, { limit: 10 });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /omni_team_members/);
  assert.match(calls[0].sql, /JOIN omni_conversations c ON c\.id = s\.conversation_id/);
});

await check("listSuggestions with operator appends team filter via conversation join", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listSuggestions(pool, { limit: 10 }, { role: "operator", id: USER_A });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /JOIN omni_conversations c ON c\.id = s\.conversation_id/);
  assert.match(calls[0].sql, /omni_team_members/);
  assert.equal(calls[0].params[1], USER_A);
});

await check("listSuggestions with admin does not append team filter", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  await listSuggestions(pool, { limit: 5 }, { role: "admin", id: USER_A });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].sql, /omni_team_members/);
  assert.deepEqual(calls[0].params, [5]);
});

await check("listSuggestions conversation_id + operator still scopes by team", async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const convId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  await listSuggestions(pool, { limit: 10, conversation_id: convId }, { role: "operator", id: USER_A });
  assert.equal(calls[0].params[1], convId);
  assert.equal(calls[0].params[2], USER_A);
  assert.match(calls[0].sql, /s\.conversation_id = \$2/);
  assert.match(calls[0].sql, /omni_team_members WHERE user_id = \$3/);
});

await check("suggestionVisibleTo: admin sees any existing suggestion", async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /SELECT 1 FROM omni_suggestions WHERE id = \$1/);
      assert.equal(params[0], SUG_B);
      return { rowCount: 1 };
    },
  };
  assert.equal(await suggestionVisibleTo(pool, SUG_B, { role: "admin", id: USER_A }), true);
});

await check("suggestionVisibleTo: operator denied for other team's suggestion", async () => {
  const pool = {
    async query(sql, params) {
      assert.match(sql, /JOIN omni_conversations/);
      assert.equal(params[0], SUG_B);
      assert.equal(params[1], USER_A);
      return { rowCount: 0 };
    },
  };
  assert.equal(
    await suggestionVisibleTo(pool, SUG_B, { role: "operator", id: USER_A }),
    false,
  );
});

await check("suggestionVisibleTo: operator allowed for own-team suggestion", async () => {
  const pool = {
    async query(sql, params) {
      assert.equal(params[0], SUG_A);
      assert.equal(params[1], USER_A);
      return { rowCount: 1 };
    },
  };
  assert.equal(
    await suggestionVisibleTo(pool, SUG_A, { role: "operator", id: USER_A }),
    true,
  );
});

console.log(`\nomni suggestion team isolation: ${passed} checks passed`);
