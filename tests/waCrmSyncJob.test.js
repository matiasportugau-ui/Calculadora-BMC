// wa_crm_sync enqueue behavior — offline. Sets env BEFORE importing config-gated
// aiWorker, so this file MUST use dynamic import (static imports hoist above env).
process.env.OMNI_AI_ORCHESTRATOR_ENABLED = "1";
process.env.OMNI_WA_CANONICAL = "1";

const { enqueueIngestAiJobs, ALLOWED_AI_JOB_TYPES } = await import(
  "../server/lib/omni/orchestrator/aiWorker.js"
);

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

function fakePool() {
  const inserts = [];
  return {
    inserts,
    query: async (sql, params) => {
      inserts.push({ sql, jobType: params?.[0] });
      return { rows: [{ id: `id-${inserts.length}` }] };
    },
  };
}

const customerWa = {
  duplicate: false,
  message: { sender: "customer" },
  channel: "wa",
  message_id: "m1",
  conversation_id: "c1",
};

assert("ALLOWED_AI_JOB_TYPES includes wa_crm_sync", ALLOWED_AI_JOB_TYPES.includes("wa_crm_sync"));

// WA + canonical ON → classify + suggest + wa_crm_sync
const poolWa = fakePool();
await enqueueIngestAiJobs(poolWa, customerWa);
const waTypes = poolWa.inserts.map((i) => i.jobType);
assert("enqueues classify", waTypes.includes("classify"));
assert("enqueues suggest", waTypes.includes("suggest"));
assert("enqueues wa_crm_sync", waTypes.includes("wa_crm_sync"));
const crmInsert = poolWa.inserts.find((i) => i.jobType === "wa_crm_sync");
assert("wa_crm_sync uses ON CONFLICT DO NOTHING (coalesce)", /ON CONFLICT DO NOTHING/.test(crmInsert.sql));
assert("classify NOT coalesced", !/ON CONFLICT DO NOTHING/.test(poolWa.inserts.find((i) => i.jobType === "classify").sql));

// Non-WA channel → no wa_crm_sync even with flag ON
const poolMl = fakePool();
await enqueueIngestAiJobs(poolMl, { ...customerWa, channel: "ml" });
assert("ml channel → no wa_crm_sync", !poolMl.inserts.map((i) => i.jobType).includes("wa_crm_sync"));

// Duplicate / non-customer → nothing enqueued
const poolDup = fakePool();
await enqueueIngestAiJobs(poolDup, { ...customerWa, duplicate: true });
assert("duplicate → no jobs", poolDup.inserts.length === 0);

console.log(`\nwaCrmSyncJob: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
