/**
 * G2 remaining: offline money eval + promote to Training KB when PAOS_PROMOTE=1.
 */
import assert from "node:assert/strict";
import { evaluateCandidateOffline, isMoneyAdjacent } from "../server/lib/paosEvaluate.js";
import { promoteCandidateToTrainingKb } from "../server/lib/paosPromote.js";
import {
  __paosCandidatesTest,
  approveCandidate,
  completeEvaluation,
  createCandidate,
  sanitizeCandidateDelta,
} from "../server/lib/paosCandidates.js";
import { __paosLedgerTest } from "../server/lib/paosEventLedger.js";
import { loadTrainingKB, deleteTrainingEntry } from "../server/lib/trainingKB.js";

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

// Money adjacent detection
assert.equal(isMoneyAdjacent({ goodAnswer: "USD 48.90 /m2" }), true);
assert.equal(isMoneyAdjacent({ goodAnswer: "consultar ficha técnica" }), false);

// Offline eval rejects price without calc provenance
{
  const fail = evaluateCandidateOffline({
    delta: {
      question: "precio isodec 100?",
      goodAnswer: "Sale USD 45 por m2 sin IVA",
    },
  });
  assert.equal(fail.pass, false);
  assert.equal(fail.details.checks.money, "fail_no_calc_provenance");

  const ok = evaluateCandidateOffline({
    delta: {
      question: "precio isodec 100?",
      goodAnswer: "USD 45/m2 ex-IVA según calculadora",
      calcProvenance: true,
      totalUsd: 45,
    },
  });
  assert.equal(ok.pass, true);
}

// Sanitize strips forgeable provenance for untrusted creates
{
  const clean = sanitizeCandidateDelta({
    question: "precio?",
    goodAnswer: "USD 40",
    calcProvenance: true,
    totalUsd: 40,
    calcResult: { total: 40 },
    source: "calc_oracle",
  });
  assert.equal(clean.calcProvenance, undefined);
  assert.equal(clean.totalUsd, undefined);
  assert.equal(clean.calcResult, undefined);
  assert.notEqual(clean.source, "calc_oracle");
}

// Structural pass without money
{
  const r = evaluateCandidateOffline({
    delta: { question: "Qué es babeta?", goodAnswer: "Remate de chapa en encuentro de techo y pared" },
  });
  assert.equal(r.pass, true);
}

// Promote path end-to-end with flags
const createdIds = [];
await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "1" }, async () => {
  __paosCandidatesTest.reset();
  __paosLedgerTest.reset();

  // offline default eval (no explicit report)
  const c = await createCandidate({
    delta: {
      question: "Qué es babeta desarrollo?",
      goodAnswer: "Pieza de chapa para encuentro techo-pared, desarrollo típico 16 cm en BMC.",
    },
  });
  const evaluated = await completeEvaluation(c.id); // null report → offline
  assert.equal(evaluated.state, "pending_approval");

  const approved = await approveCandidate(c.id, "canary");
  assert.equal(approved.state, "canary");
  assert.ok(approved.trainingKbId, "should write training KB on promote");
  createdIds.push(approved.trainingKbId);

  const kb = loadTrainingKB();
  const entry = (kb.entries || []).find((e) => e.id === approved.trainingKbId);
  assert.ok(entry);
  assert.equal(entry.status, "pending"); // canary
  assert.equal(entry.source, "paos_canary");

  // active promote
  const c2 = await createCandidate({
    delta: {
      question: "Color estándar techo?",
      goodAnswer: "Consultar stock y ficha; no inventar tono sin catálogo.",
    },
  });
  await completeEvaluation(c2.id);
  const act = await approveCandidate(c2.id, "active");
  assert.equal(act.state, "active");
  createdIds.push(act.trainingKbId);
  const entry2 = loadTrainingKB().entries.find((e) => e.id === act.trainingKbId);
  assert.equal(entry2.status, "active");
  assert.equal(entry2.permanent, true);

  // Forged client provenance on create must not pass money guard
  const forged = await createCandidate({
    delta: {
      question: "precio panel 100mm?",
      goodAnswer: "Sale USD 99.00 /m2 sin IVA inventado",
      calcProvenance: true,
      totalUsd: 99,
      calcResult: { total: 99 },
      source: "calc_oracle",
    },
  });
  assert.equal(forged.delta.calcProvenance, undefined);
  assert.equal(forged.delta.totalUsd, undefined);
  const forgedEval = await completeEvaluation(forged.id, null);
  assert.equal(forgedEval.state, "rejected");
  assert.equal(forgedEval.evalReport?.details?.checks?.money, "fail_no_calc_provenance");
});

// promote disabled
await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "0" }, () => {
  const r = promoteCandidateToTrainingKb(
    {
      id: "x",
      state: "canary",
      delta: { question: "q?", goodAnswer: "long enough answer" },
    },
    "canary",
  );
  assert.equal(r.ok, false);
  assert.equal(r.error, "paos_promote_disabled");
});

// cleanup KB noise
for (const id of createdIds) {
  try {
    if (id) deleteTrainingEntry(id);
  } catch {
    /* ignore */
  }
}

__paosCandidatesTest.reset();
__paosLedgerTest.reset();

console.log("paosPromote.test.js PASS");
