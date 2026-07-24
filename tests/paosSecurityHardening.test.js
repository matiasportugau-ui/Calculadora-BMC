/**
 * Critical hardening after #777 merge:
 * - client pass ignored at HTTP evaluate boundary (library still allows trusted reports)
 * - forgeable provenance stripped on create
 * - rollback revokes Training KB
 * - PG read-through when memory cold (multi-instance)
 */
import assert from "node:assert/strict";
import {
  __paosCandidatesTest,
  approveCandidate,
  completeEvaluation,
  createCandidate,
  getCandidate,
  rollbackCandidate,
  sanitizeCandidateDelta,
} from "../server/lib/paosCandidates.js";
import { __paosLedgerTest } from "../server/lib/paosEventLedger.js";
import { deleteTrainingEntry, loadTrainingKB } from "../server/lib/trainingKB.js";

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

/** Minimal in-memory pool stub implementing query subset used by candidates. */
function makeMemoryPg() {
  /** @type {Map<string, object>} */
  const rows = new Map();
  return {
    rows,
    async query(sql, params = []) {
      const s = String(sql);
      if (/CREATE TABLE/i.test(s) || /CREATE INDEX/i.test(s)) {
        return { rows: [] };
      }
      if (/INSERT INTO public\.learning_candidates/i.test(s)) {
        const [
          id,
          state,
          scope,
          source,
          sessionId,
          deltaJson,
          evalJson,
          trainingKbId,
          rejectReason,
          createdAt,
          updatedAt,
        ] = params;
        const row = {
          id,
          state,
          scope,
          source,
          session_id: sessionId,
          delta: typeof deltaJson === "string" ? JSON.parse(deltaJson) : deltaJson,
          eval_report: evalJson ? (typeof evalJson === "string" ? JSON.parse(evalJson) : evalJson) : null,
          training_kb_id: trainingKbId,
          reject_reason: rejectReason,
          created_at: createdAt,
          updated_at: updatedAt,
        };
        rows.set(id, row);
        return { rows: [row] };
      }
      if (/SELECT \* FROM public\.learning_candidates WHERE id/i.test(s)) {
        const id = params[0];
        const row = rows.get(id);
        return { rows: row ? [row] : [] };
      }
      if (/SELECT \* FROM public\.learning_candidates WHERE state/i.test(s)) {
        const state = params[0];
        return {
          rows: [...rows.values()]
            .filter((r) => r.state === state)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        };
      }
      if (/SELECT \* FROM public\.learning_candidates ORDER BY/i.test(s)) {
        return {
          rows: [...rows.values()].sort((a, b) =>
            String(b.created_at).localeCompare(String(a.created_at)),
          ),
        };
      }
      return { rows: [] };
    },
    async end() {},
  };
}

const kbIds = [];

await withEnv({ PAOS_ENABLED: "1", PAOS_PROMOTE: "1" }, async () => {
  __paosCandidatesTest.reset();
  __paosLedgerTest.reset();

  // HTTP evaluate contract: callers must pass null (simulate route)
  const short = await createCandidate({
    delta: {
      question: "precio panel?",
      goodAnswer: "USD 12.00 /m2",
      calcProvenance: true,
      totalUsd: 12,
    },
  });
  // Even if a malicious client asked for pass:true, route uses null → offline fail
  const evaluated = await completeEvaluation(short.id, null);
  assert.equal(evaluated.state, "rejected");

  // Rollback revokes active KB
  const c = await createCandidate({
    delta: {
      question: "Que es babeta?",
      goodAnswer: "Remate de chapa en encuentro techo-pared usado en obras BMC.",
    },
  });
  await completeEvaluation(c.id, null);
  const act = await approveCandidate(c.id, "active");
  kbIds.push(act.trainingKbId);
  const before = loadTrainingKB().entries.find((e) => e.id === act.trainingKbId);
  assert.equal(before.status, "active");
  const rolled = await rollbackCandidate(c.id);
  assert.equal(rolled.kbRevoked, true);
  const after = loadTrainingKB().entries.find((e) => e.id === act.trainingKbId);
  assert.equal(after.status, "rejected");
  assert.equal(after.permanent, false);

  // PG read-through after cold memory (simulates other Cloud Run instance)
  const pg = makeMemoryPg();
  __paosCandidatesTest.setPool(pg);
  const remote = await createCandidate({
    delta: {
      question: "Color techo estandar?",
      goodAnswer: "Consultar stock y ficha tecnica; no inventar tono.",
    },
  });
  assert.ok(pg.rows.has(remote.id), "must dual-write to PG");
  // Cold memory on "instance B"
  __paosCandidatesTest.reset();
  __paosCandidatesTest.setPool(pg);
  const hydrated = await getCandidate(remote.id);
  assert.ok(hydrated, "must hydrate from PG when memory empty");
  assert.equal(hydrated.id, remote.id);
  assert.equal(hydrated.state, "drafted");

  // trustedProvenance opt-in keeps server-attested fields
  const trusted = sanitizeCandidateDelta(
    { calcProvenance: "ae_agent", totalUsd: 10, question: "q" },
    { trustedProvenance: true },
  );
  assert.equal(trusted.calcProvenance, "ae_agent");
  assert.equal(trusted.totalUsd, 10);
});

for (const id of kbIds) {
  try {
    if (id) deleteTrainingEntry(id);
  } catch {
    /* ignore */
  }
}
__paosCandidatesTest.reset();
__paosLedgerTest.reset();
console.log("paosSecurityHardening.test.js PASS");
