/**
 * IMP-PAOS-04: with PAOS_ENABLED=1, knowledge promote must not call addTrainingEntry active.
 * Workspace path must run offline money-guard (no forged structural pass).
 */
import assert from "node:assert/strict";
import {
  __paosCandidatesTest,
  completeEvaluation,
  createCandidate,
  listCandidates,
} from "../server/lib/paosCandidates.js";
import { __paosLedgerTest } from "../server/lib/paosEventLedger.js";
import { isPaosEnabled } from "../server/lib/paosConfig.js";

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

/** Mirrors workspace knowledge branch when PAOS on */
async function workspaceKnowledgePaosPath({ question, goodAnswer, crId }) {
  if (!isPaosEnabled()) {
    return { mode: "legacy_addTrainingEntry", status: "active" };
  }
  const cand = await createCandidate({
    source: "panelin_workspace",
    sessionId: `cr:${crId}`,
    delta: { question, goodAnswer, crId },
  });
  const evaluated = await completeEvaluation(cand.id, null);
  return {
    mode: "paos_candidate",
    bmcKbId: null,
    candidateId: cand.id,
    candidate: (await listCandidates()).find((c) => c.id === cand.id),
    evaluatedState: evaluated.state,
  };
}

await withEnv({ PAOS_ENABLED: "0" }, async () => {
  const r = await workspaceKnowledgePaosPath({
    question: "q",
    goodAnswer: "a",
    crId: "cr-legacy",
  });
  assert.equal(r.mode, "legacy_addTrainingEntry");
  assert.equal(r.status, "active");
});

await withEnv({ PAOS_ENABLED: "1" }, async () => {
  __paosCandidatesTest.reset();
  __paosLedgerTest.reset();
  const r = await workspaceKnowledgePaosPath({
    question: "Cuántos m2?",
    goodAnswer: "Usar calculadora del sistema siempre",
    crId: "cr-paos",
  });
  assert.equal(r.mode, "paos_candidate");
  assert.equal(r.bmcKbId, null);
  assert.equal(r.candidate.state, "pending_approval");
  assert.notEqual(r.candidate.state, "active");

  // Money-adjacent workspace CR must fail offline eval (no forged pass)
  const money = await workspaceKnowledgePaosPath({
    question: "precio isodec 100?",
    goodAnswer: "USD 45.00 /m2 sin IVA",
    crId: "cr-money",
  });
  assert.equal(money.evaluatedState, "rejected");
  assert.equal(money.candidate.state, "rejected");
});

__paosCandidatesTest.reset();
__paosLedgerTest.reset();
console.log("paosWorkspaceGate.test.js PASS");
