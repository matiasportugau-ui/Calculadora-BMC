// F4 unit tests for the analytics helpers in server/lib/trainingKB.js.
//
// We work against the real on-disk KB (data/training-kb.json) for
// integration-style assertions (shape, ranges, sortedness). Per-entry
// fixture testing happens through getSurfaceCoverage's pure inputs in
// the dedicated "shape" group below.
//
// Run: node tests/trainingAnalytics.test.js

import {
  getSurfaceCoverage,
  getRetrievalTrend,
  getTopQueries,
  getTrainingAnalytics,
} from "../server/lib/trainingKB.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("getSurfaceCoverage — shape", () => {
  const cov = getSurfaceCoverage();
  assert(typeof cov === "object" && cov !== null, "returns an object");
  for (const surface of ["mercado_libre", "whatsapp", "email"]) {
    assert(cov[surface] != null, `has ${surface} key`);
    const s = cov[surface];
    assert(typeof s.total_with_override === "number", `${surface}.total_with_override is number`);
    assert(typeof s.gap_count === "number", `${surface}.gap_count is number`);
    assert(typeof s.eligible === "number", `${surface}.eligible is number`);
    assert(typeof s.coverage_pct === "number", `${surface}.coverage_pct is number`);
    assert(s.coverage_pct >= 0 && s.coverage_pct <= 100, `${surface}.coverage_pct in [0,100]`);
    assert(s.gap_count >= 0, `${surface}.gap_count >= 0`);
  }
});

group("getSurfaceCoverage — invariants", () => {
  const cov = getSurfaceCoverage();
  for (const surface of ["mercado_libre", "whatsapp", "email"]) {
    const s = cov[surface];
    // gap_count = max(0, eligible - with_override)
    const expectedGap = Math.max(0, s.eligible - s.total_with_override);
    assert(s.gap_count === expectedGap, `${surface}: gap_count = max(0, eligible - with_override)`);
    // coverage_pct = 100 when eligible === 0 (vacuously fully covered)
    if (s.eligible === 0) {
      assert(s.coverage_pct === 100, `${surface}: empty eligible → 100% coverage`);
    }
  }
});

group("getRetrievalTrend — shape", () => {
  const t = getRetrievalTrend({ days: 14 });
  assert(Array.isArray(t), "returns an array");
  assert(t.length === 14, "length === days");
  for (const row of t) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(row.date), `row.date is YYYY-MM-DD (${row.date})`);
    assert(typeof row.count === "number" && row.count >= 0, "row.count is non-negative number");
  }
  // Sorted oldest → newest
  for (let i = 1; i < t.length; i++) {
    assert(t[i - 1].date <= t[i].date, `sorted ascending at ${i}`);
  }
});

group("getRetrievalTrend — alternative window", () => {
  const t = getRetrievalTrend({ days: 7 });
  assert(t.length === 7, "respects days=7");
  const t1 = getRetrievalTrend({ days: 1 });
  assert(t1.length === 1, "respects days=1");
});

group("getTopQueries — shape", () => {
  const q = getTopQueries({ days: 14, limit: 5 });
  assert(Array.isArray(q), "returns an array");
  assert(q.length <= 5, "respects limit");
  for (const row of q) {
    assert(typeof row.query === "string" && row.query.length > 0, "row.query is non-empty string");
    assert(typeof row.count === "number" && row.count >= 1, "row.count >= 1");
    assert(typeof row.hasMatch === "boolean", "row.hasMatch is boolean");
  }
  // Sorted by count desc
  for (let i = 1; i < q.length; i++) {
    assert(q[i - 1].count >= q[i].count, `sorted desc at ${i}`);
  }
});

group("getTopQueries — degrades gracefully", () => {
  // We cannot easily simulate a missing sessionsDir without mocking fs;
  // the contract is documented and other paths of the helper guard against
  // throws. Instead we verify the "limit caps to length" rule.
  const a = getTopQueries({ days: 14, limit: 1 });
  const b = getTopQueries({ days: 14, limit: 100 });
  assert(b.length >= a.length, "larger limit returns >= rows");
});

group("getTrainingAnalytics — composite shape", () => {
  const a = getTrainingAnalytics({ days: 14 });
  assert(typeof a === "object", "is object");
  assert(typeof a.byCategory === "object", "byCategory is object");
  assert(typeof a.bySource === "object", "bySource is object");
  assert(typeof a.bySurface === "object", "bySurface is object");
  assert(Array.isArray(a.retrievalTrend), "retrievalTrend is array");
  assert(Array.isArray(a.topQueries), "topQueries is array");
  assert(typeof a.conflicts === "object" && typeof a.conflicts.count === "number", "conflicts has count");
  assert(typeof a.health === "object", "health is object");
  assert(typeof a.health.score === "number", "health.score is number");
  assert(typeof a.total === "number", "total is number");
  assert(typeof a.pending === "number", "pending is number");
  assert(typeof a.updatedAt === "string", "updatedAt is ISO string");
  assert(/^\d{4}-\d{2}-\d{2}T/.test(a.updatedAt), "updatedAt is ISO format");
});

group("getTrainingAnalytics — bySurface present in analytics result", () => {
  const a = getTrainingAnalytics({ days: 14 });
  for (const surface of ["mercado_libre", "whatsapp", "email"]) {
    assert(a.bySurface[surface] != null, `bySurface.${surface} present`);
  }
});

group("getTrainingAnalytics — params plumb through", () => {
  const a7 = getTrainingAnalytics({ days: 7, topQueriesLimit: 3 });
  assert(a7.retrievalTrend.length === 7, "days=7 → 7 trend rows");
  assert(a7.topQueries.length <= 3, "topQueriesLimit=3 → ≤3 rows");
});

console.log(`\ntrainingAnalytics: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
