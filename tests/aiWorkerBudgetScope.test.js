// Budget gate scoped to 'suggest' + dead-letter metric — offline (fake pool).
import { runAiJobById } from "../server/lib/omni/orchestrator/aiWorker.js";
import { formatPrometheusMetrics } from "../server/lib/omni/omniMetrics.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

// Fake pool that answers runAiJobById's queries by SQL shape. dailyCost is huge so
// we are unambiguously over any configured OMNI_AI_DAILY_BUDGET_USD.
function jobPool(job) {
  return {
    query: async (sql) => {
      if (/SELECT \* FROM omni_ai_jobs WHERE id/.test(sql)) return { rows: [job] };
      if (/SUM\(cost_usd\)/.test(sql)) return { rows: [{ total: 999999 }] };
      if (/SELECT m\.body/.test(sql)) return { rows: [] }; // → message_not_found, ends processAiJob early
      if (/status = CASE WHEN attempts/.test(sql)) return { rows: [{ status: "failed" }] };
      return { rows: [] };
    },
  };
}

// suggest over budget → refused
const suggestRes = await runAiJobById(
  jobPool({ id: "j1", job_type: "suggest", status: "pending", attempts: 0, conversation_id: "c1", message_id: "m1" }),
  "j1",
  {},
);
assert("over-budget 'suggest' → ai_daily_budget_exceeded", suggestRes.ok === false && suggestRes.error === "ai_daily_budget_exceeded");

// wa_crm_sync over budget → NOT refused (bookkeeping keeps draining)
const crmRes = await runAiJobById(
  jobPool({ id: "j2", job_type: "wa_crm_sync", status: "pending", attempts: 0, conversation_id: "c1", message_id: "m1" }),
  "j2",
  {},
);
assert("over-budget 'wa_crm_sync' → NOT budget-blocked", crmRes.error !== "ai_daily_budget_exceeded");
assert("over-budget 'wa_crm_sync' → proceeds (ok)", crmRes.ok === true);

// Dead-letter is alertable in the metrics output
const metrics = formatPrometheusMetrics({
  omni_ai_jobs_completed_24h: [{ job_type: "wa_crm_sync", status: "dead", total: 2 }],
});
assert("metrics expose dead wa_crm_sync jobs",
  metrics.includes('omni_ai_jobs_24h{job_type="wa_crm_sync",status="dead"} 2'));

console.log(`\naiWorkerBudgetScope: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
