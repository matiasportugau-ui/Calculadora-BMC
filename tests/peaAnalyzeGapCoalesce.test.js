/**
 * Bug CF — coalesce active analyze_gap jobs per gap (offline).
 * Run: node tests/peaAnalyzeGapCoalesce.test.js
 */
import {
  ACTIVE_ANALYZE_GAP_STATUSES,
  enqueueAnalyzeGapJob,
} from "../server/lib/pea/outbox.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function fakeDb({ existingId = null, insertId = "job-new", throwUnique = false } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      const norm = String(sql).replace(/\s+/g, " ").trim();
      if (/SELECT id FROM pea\.jobs/i.test(norm) && /analyze_gap/i.test(norm)) {
        return { rows: existingId ? [{ id: existingId }] : [] };
      }
      if (/INSERT INTO pea\.jobs/i.test(norm) && /analyze_gap/i.test(norm)) {
        if (throwUnique) {
          const err = new Error('duplicate key value violates unique constraint "pea_jobs_analyze_gap_active_dedup"');
          err.code = "23505";
          // After unique race, SELECT finds the winner.
          existingId = "job-winner";
          throw err;
        }
        return { rows: [{ id: insertId }] };
      }
      throw new Error(`unexpected sql: ${norm}`);
    },
  };
}

assert(
  ACTIVE_ANALYZE_GAP_STATUSES.includes("pending") &&
    ACTIVE_ANALYZE_GAP_STATUSES.includes("running") &&
    ACTIVE_ANALYZE_GAP_STATUSES.includes("failed"),
  "active statuses cover pending/running/failed",
);

{
  const db = fakeDb({ existingId: "job-active" });
  const out = await enqueueAnalyzeGapJob(db, {
    gapId: "gap-1",
    input: { force: true },
  });
  assert(out.jobId === "job-active", "returns existing active job id");
  assert(out.coalesced === true, "marks coalesced when active job exists");
  assert(
    db.calls.length === 1 && /SELECT id FROM pea\.jobs/i.test(db.calls[0].sql),
    "does not INSERT when active job exists",
  );
}

{
  const db = fakeDb({ existingId: null, insertId: "job-fresh" });
  const out = await enqueueAnalyzeGapJob(db, {
    gapId: "gap-2",
    input: { trigger: "threshold", gap_id: "gap-2" },
  });
  assert(out.jobId === "job-fresh", "inserts new analyze_gap when none active");
  assert(out.coalesced === false, "not coalesced on fresh insert");
  assert(
    db.calls.some((c) => /INSERT INTO pea\.jobs/i.test(c.sql) && c.params?.[0] === "gap-2"),
    "INSERT uses gap_id param",
  );
  const insert = db.calls.find((c) => /INSERT INTO pea\.jobs/i.test(c.sql));
  assert(
    insert && String(insert.params?.[1] || "").includes("threshold"),
    "INSERT stores trigger input_json",
  );
}

{
  const db = fakeDb({ existingId: null, throwUnique: true });
  const out = await enqueueAnalyzeGapJob(db, { gapId: "gap-race", input: { force: true } });
  assert(out.jobId === "job-winner", "unique race returns winner job id");
  assert(out.coalesced === true, "unique race marked coalesced");
  assert(
    db.calls.filter((c) => /SELECT id FROM pea\.jobs/i.test(c.sql)).length >= 2,
    "unique race re-SELECTs after 23505",
  );
}

{
  let threw = null;
  try {
    await enqueueAnalyzeGapJob(fakeDb(), { gapId: "", input: {} });
  } catch (e) {
    threw = e;
  }
  assert(threw?.message === "gap_id_required", "rejects missing gapId");
}

{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mig = fs.readFileSync(
    path.join(__dirname, "../server/migrations/pea/004_pea_analyze_gap_active_dedup.sql"),
    "utf8",
  );
  assert(
    /pea_jobs_analyze_gap_active_dedup/.test(mig) &&
      /job_type = 'analyze_gap'/.test(mig) &&
      /status IN \('pending', 'running', 'failed'\)/.test(mig),
    "migration 004 unique index matches coalesce statuses",
  );
}

{
  const routeSrc = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../server/routes/pea.js"),
    "utf8",
  );
  assert(
    /enqueueAnalyzeGapJob/.test(routeSrc) &&
      !/INSERT INTO pea\.jobs \(job_type, gap_id, status, input_json\)/.test(routeSrc),
    "diagnose route uses coalesce helper (no raw INSERT)",
  );
  const gapSrc = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../server/lib/pea/gapEvents.js"),
    "utf8",
  );
  assert(
    /enqueueAnalyzeGapJob/.test(gapSrc) && !/enqueuePeaJob\(/.test(gapSrc),
    "auto-diagnose path uses coalesce helper",
  );
}

console.log(`\npeaAnalyzeGapCoalesce: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
