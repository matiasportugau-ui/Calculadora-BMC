/**
 * Full supervised loop against real shipped modules (not re-implemented).
 * create → offline eval → approve canary/active → Training KB id.
 */
import assert from "node:assert/strict";
import {
  __paosCandidatesTest,
  approveCandidate,
  completeEvaluation,
  createCandidate,
} from "../server/lib/paosCandidates.js";
import { __paosLedgerTest, appendPaosEvent, listPaosEvents } from "../server/lib/paosEventLedger.js";
import { evaluateCandidateOffline } from "../server/lib/paosEvaluate.js";
import { deleteTrainingEntry, loadTrainingKB } from "../server/lib/trainingKB.js";
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

const kbCleanup = [];

withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "1" }, () => {
  __paosCandidatesTest.reset();
  __paosLedgerTest.reset();
  assert.equal(isPaosEnabled(), true);

  // money guard on real evaluator
  const moneyFail = evaluateCandidateOffline({
    delta: {
      question: "precio panel 100mm?",
      goodAnswer: "USD 40 por m2 sin usar calculadora",
    },
  });
  assert.equal(moneyFail.pass, false);

  // ledger emit
  appendPaosEvent({ type: "session.chat_turn", sessionId: "e2e-1", payload: { t: 1 } });
  assert.ok(listPaosEvents({ sessionId: "e2e-1" }).length >= 1);

  // create → evaluate (offline) → approve canary → KB pending
  const c = createCandidate({
    sessionId: "e2e-1",
    source: "e2e",
    delta: {
      question: "Que es babeta de desarrollo?",
      goodAnswer: "Remate de chapa en encuentro techo-pared; tipico desarrollo 16 cm en obras BMC.",
    },
  });
  assert.equal(c.state, "drafted");
  const ev = completeEvaluation(c.id, null);
  assert.equal(ev.state, "pending_approval");
  const can = approveCandidate(c.id, "canary");
  assert.equal(can.state, "canary");
  assert.ok(can.trainingKbId);
  kbCleanup.push(can.trainingKbId);
  const entry = loadTrainingKB().entries.find((e) => e.id === can.trainingKbId);
  assert.ok(entry);
  assert.equal(entry.status, "pending");
  assert.equal(entry.source, "paos_canary");

  // active path (non-money answer so offline eval passes without calc provenance)
  const c2 = createCandidate({
    delta: {
      question: "Como cotizar sin inventar precios?",
      goodAnswer: "Siempre usar la herramienta de cotizacion del sistema y no estimar a ojo.",
    },
  });
  const ev2 = completeEvaluation(c2.id, null);
  assert.equal(ev2.state, "pending_approval", JSON.stringify(ev2.evalReport));
  const act = approveCandidate(c2.id, "active");
  assert.equal(act.state, "active");
  assert.ok(act.trainingKbId);
  kbCleanup.push(act.trainingKbId);
  const e2 = loadTrainingKB().entries.find((e) => e.id === act.trainingKbId);
  assert.equal(e2.status, "active");
  assert.equal(e2.permanent, true);

});

// workspace-style: PAOS on, promote off → pending_approval, cannot approve
withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "0" }, () => {
  __paosCandidatesTest.reset();
  const cr = createCandidate({
    source: "panelin_workspace",
    delta: { question: "WS Q about panels?", goodAnswer: "Answer without inventing USD prices here." },
  });
  const evaluated = completeEvaluation(cr.id, null);
  assert.equal(evaluated.state, "pending_approval");
  assert.throws(() => approveCandidate(cr.id, "active"), /paos_promote_disabled/);
});
for (const id of kbCleanup) {
  try {
    if (id) deleteTrainingEntry(id);
  } catch {
    /* ignore */
  }
}
__paosCandidatesTest.reset();
__paosLedgerTest.reset();
console.log("paosE2eLoop.test.js PASS");
