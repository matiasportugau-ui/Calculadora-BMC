// resolveSuggestion — resolved_at stamping + pre-migration-015 fallback. Offline,
// fake pool. Guards the dormancy contract: deploying this code before migration 015
// must NOT break approve/reject (undefined_column 42703 → legacy UPDATE retry).
import { resolveSuggestion } from "../server/lib/omni/orchestrator/suggestions.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

function fakePool({ hasResolvedAt = true, found = true } = {}) {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/UPDATE omni_suggestions/.test(sql)) {
        if (/resolved_at = now\(\)/.test(sql) && !hasResolvedAt) {
          const err = new Error('column "resolved_at" of relation "omni_suggestions" does not exist');
          err.code = "42703";
          throw err;
        }
        if (!found) return { rows: [] };
        return { rows: [{ id: params[0], approval_state: params[1], job_id: "j1", metadata: {}, body: "x", conversation_id: "c1", channel: "wa" }] };
      }
      return { rows: [] }; // omni_ai_jobs approval_state mirror
    },
  };
}

// ── accept stamps resolved_at ──
const p1 = fakePool();
const r1 = await resolveSuggestion(p1, "s1", "accept", { actor: "op1" });
assert("accept → ok + accepted", r1.ok === true && r1.suggestion.approval_state === "accepted");
assert("accept UPDATE stamps resolved_at = now()", /resolved_at = now\(\)/.test(p1.queries[0].sql));
assert("only pending rows are resolvable (guard in WHERE)", /approval_state = 'pending'/.test(p1.queries[0].sql));

// ── reject also stamps ──
const p2 = fakePool();
const r2 = await resolveSuggestion(p2, "s1", "reject", {});
assert("reject → rejected + stamped", r2.ok === true && r2.suggestion.approval_state === "rejected" && /resolved_at/.test(p2.queries[0].sql));

// ── pre-migration-015 schema: 42703 → falls back to legacy UPDATE, still resolves ──
const p3 = fakePool({ hasResolvedAt: false });
const r3 = await resolveSuggestion(p3, "s1", "accept", {});
assert("42703 → fallback UPDATE without resolved_at", r3.ok === true && p3.queries.length >= 2 && !/resolved_at/.test(p3.queries[1].sql));
assert("fallback preserves accept semantics", r3.suggestion.approval_state === "accepted");

// ── non-42703 errors propagate (no silent swallowing) ──
let threw = false;
try {
  await resolveSuggestion({
    query: async () => { const e = new Error("boom"); e.code = "57014"; throw e; },
  }, "s1", "accept", {});
} catch (e) { threw = e.code === "57014"; }
assert("non-42703 error propagates", threw);

// ── not found / already resolved ──
const p4 = fakePool({ found: false });
const r4 = await resolveSuggestion(p4, "sX", "accept", {});
assert("missing/resolved → ok:false", r4.ok === false && r4.error === "suggestion_not_found_or_resolved");

console.log(`\nomniSuggestionResolve: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
