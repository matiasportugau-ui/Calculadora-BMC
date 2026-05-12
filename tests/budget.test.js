/**
 * Contract tests for server/lib/budget.js
 * Run: node tests/budget.test.js
 */

import { checkAndCount, getStats, _resetBudgetForTests } from "../server/lib/budget.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

group("No caps → always passes", () => {
  _resetBudgetForTests();
  for (let i = 0; i < 50; i += 1) {
    const r = checkAndCount({ identity: "conv-1", caps: {} });
    if (!r.ok) { failed += 1; console.error(`  ✗ unexpected reject at ${i}`); break; }
  }
  passed += 1;
  const stats = getStats("conv-1");
  assert(stats.turns_1min === 50, `turns_1min === 50, got ${stats.turns_1min}`);
});

group("turnsPerMin enforced", () => {
  _resetBudgetForTests();
  const caps = { turnsPerMin: 3 };
  assert(checkAndCount({ identity: "c2", caps }).ok === true, "1st passes");
  assert(checkAndCount({ identity: "c2", caps }).ok === true, "2nd passes");
  assert(checkAndCount({ identity: "c2", caps }).ok === true, "3rd passes");
  const r4 = checkAndCount({ identity: "c2", caps });
  assert(r4.ok === false, "4th rejected");
  assert(r4.reason === "turn_cap_1min", "reason turn_cap_1min");
  assert(r4.retryAfterSec === 60, "retryAfter 60s");
});

group("Different identities are isolated", () => {
  _resetBudgetForTests();
  const caps = { turnsPerMin: 1 };
  assert(checkAndCount({ identity: "alice", caps }).ok === true, "alice 1st passes");
  assert(checkAndCount({ identity: "alice", caps }).ok === false, "alice 2nd rejected");
  assert(checkAndCount({ identity: "bob", caps }).ok === true, "bob 1st passes (isolated)");
});

group("anon fallback when identity missing", () => {
  _resetBudgetForTests();
  const r = checkAndCount({ identity: null, caps: { turnsPerMin: 5 } });
  assert(r.ok === true, "null identity accepted");
  const r2 = checkAndCount({ identity: undefined, caps: {} });
  assert(r2.ok === true, "undefined identity accepted");
  const stats = getStats("anon");
  assert(stats.turns_1min === 2, "anon counter has 2 turns");
});

group("tokensPer24h enforced", () => {
  _resetBudgetForTests();
  const caps = { tokensPer24h: 1000 };
  assert(checkAndCount({ identity: "t1", caps, tokensEstimate: 600 }).ok === true, "600 tokens passes");
  const r = checkAndCount({ identity: "t1", caps, tokensEstimate: 500 });
  assert(r.ok === false, "next 500 rejected (would total 1100)");
  assert(r.reason === "token_cap_24h", "reason token_cap_24h");
});

group("Records do NOT persist tokens when rejected", () => {
  _resetBudgetForTests();
  const caps = { turnsPerMin: 1 };
  checkAndCount({ identity: "r1", caps, tokensEstimate: 100 });
  const before = getStats("r1");
  checkAndCount({ identity: "r1", caps, tokensEstimate: 9999 });
  const after = getStats("r1");
  assert(before.tokens_24h === after.tokens_24h, "rejected turn does not bump token counter");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} budget: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
