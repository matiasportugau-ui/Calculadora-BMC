/**
 * IMP-PAOS-04: with PAOS_ENABLED=1, knowledge promote must not call addTrainingEntry active.
 * Tests pure gate helper by re-using createCandidate path (same as workspace).
 */
import assert from "node:assert/strict";
import { __paosCandidatesTest, completeEvaluation, createCandidate, listCandidates } from "../server/lib/paosCandidates.js";
import { __paosLedgerTest } from "../server/lib/paosEventLedger.js";
import { isPaosEnabled } from "../server/lib/paosConfig.js";

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined || v === null) delete process.env[k];
    else process.env[k] = String(v);
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Mirrors workspace knowledge branch when PAOS on */
function workspaceKnowledgePaosPath({ question, goodAnswer, crId }) {
  if (!isPaosEnabled()) {
    return { mode: "legacy_addTrainingEntry", status: "active" };
  }
  const cand = createCandidate({
    source: "panelin_workspace",
    sessionId: `cr:${crId}`,
    delta: { question, goodAnswer, crId },
  });
  completeEvaluation(cand.id, {
    pass: !!(question && goodAnswer),
    details: { kind: "workspace_cr_structural", crId },
  });
  return {
    mode: "paos_candidate",
    bmcKbId: null,
    candidateId: cand.id,
    candidate: listCandidates().find((c) => c.id === cand.id),
  };
}

withEnv({ PAOS_ENABLED: "0" }, () => {
  const r = workspaceKnowledgePaosPath({
    question: "q",
    goodAnswer: "a",
    crId: "cr-legacy",
  });
  assert.equal(r.mode, "legacy_addTrainingEntry");
  assert.equal(r.status, "active");
});

withEnv({ PAOS_ENABLED: "1" }, () => {
  __paosCandidatesTest.reset();
  __paosLedgerTest.reset();
  const r = workspaceKnowledgePaosPath({
    question: "Cuántos m2?",
    goodAnswer: "Usar calculadora",
    crId: "cr-paos",
  });
  assert.equal(r.mode, "paos_candidate");
  assert.equal(r.bmcKbId, null);
  assert.equal(r.candidate.state, "pending_approval");
  assert.notEqual(r.candidate.state, "active");
});

__paosCandidatesTest.reset();
__paosLedgerTest.reset();
console.log("paosWorkspaceGate.test.js PASS");
