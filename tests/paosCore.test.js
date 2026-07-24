/**
 * PAOS G2 core: SM illegal transitions, ledger memory, flags, no silent promote path helpers.
 */
import assert from "node:assert/strict";
import { canTransition, transition, canEnterPendingApproval } from "../server/lib/paosCandidateSm.js";
import {
  __paosCandidatesTest,
  approveCandidate,
  completeEvaluation,
  createCandidate,
  getCandidate,
  listCandidates,
} from "../server/lib/paosCandidates.js";
import {
  __paosLedgerTest,
  appendPaosEvent,
  listPaosEvents,
} from "../server/lib/paosEventLedger.js";

async function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined || v === null) delete process.env[k];
    else process.env[k] = String(v);
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

__paosCandidatesTest.reset();
__paosLedgerTest.reset();

// --- SM ---
assert.equal(canTransition("drafted", "active").ok, false);
assert.equal(canTransition("drafted", "active").error, "illegal_drafted_to_active");
assert.equal(canTransition("drafted", "evaluating").ok, true);
assert.equal(canTransition("evaluating", "pending_approval").ok, true);
assert.equal(canTransition("pending_approval", "canary").ok, true);
assert.throws(() => transition("drafted", "active"), /illegal_drafted_to_active/);
assert.equal(canEnterPendingApproval({ pass: true }), true);
assert.equal(canEnterPendingApproval({ pass: false }), false);
assert.equal(canEnterPendingApproval(null), false);

// --- Flags off: no ledger ---
await withEnv({ PAOS_ENABLED: "0" }, () => {
  __paosLedgerTest.reset();
  const r = appendPaosEvent({ type: "agent.tool", payload: { tool: "x" } });
  assert.equal(r, null);
  assert.equal(__paosLedgerTest.getMemory().length, 0);
});

// --- Flags on: ledger + candidates ---
await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "1" }, async () => {
  __paosLedgerTest.reset();
  __paosCandidatesTest.reset();

  appendPaosEvent({
    type: "session.chat_turn",
    sessionId: "sess-1",
    payload: { q: "hola" },
  });
  const events = listPaosEvents({ sessionId: "sess-1" });
  assert.ok(events.length >= 1);
  assert.equal(events[0].type, "session.chat_turn");

  const c = await createCandidate({
    sessionId: "sess-1",
    delta: { question: "m2?", goodAnswer: "use calc" },
  });
  assert.equal(c.state, "drafted");
  assert.throws(() => transition(c.state, "active"), /illegal/);

  const failed = await completeEvaluation(c.id, { pass: false, details: {} });
  assert.equal(failed.state, "rejected");

  const c2 = await createCandidate({ delta: { question: "a", goodAnswer: "b" } });
  const passed = await completeEvaluation(c2.id, { pass: true, details: { suite: "structural" } });
  assert.equal(passed.state, "pending_approval");

  const approved = await approveCandidate(c2.id, "canary");
  assert.equal(approved.state, "canary");

  assert.ok((await listCandidates()).length >= 2);
  assert.ok(await getCandidate(c2.id));
});

// Promote disabled
await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "0" }, async () => {
  __paosCandidatesTest.reset();
  const c = await createCandidate({ delta: { question: "q", goodAnswer: "a" } });
  await completeEvaluation(c.id, { pass: true });
  await assert.rejects(() => approveCandidate(c.id, "canary"), /paos_promote_disabled/);
});

__paosCandidatesTest.reset();
__paosLedgerTest.reset();
console.log("paosCore.test.js PASS");
