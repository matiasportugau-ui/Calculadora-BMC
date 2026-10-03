// #409 code boxes — offline. No DB, no network.
// node tests/omniEnqueueGuards.test.js
import assert from "node:assert/strict";
import { enqueueAiJob } from "../server/lib/omni/orchestrator/aiWorker.js";
import {
  createDeal,
  updateDeal,
  OMNI_DEAL_PROPERTIES_MAX_BYTES,
} from "../server/lib/omni/deals/dealService.js";
import { automationRulePatchSchema } from "../server/lib/omni/automationRulePatch.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ok ${name}`);
    });
}

function costPool(total) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SUM(cost_usd)")) return { rows: [{ total }] };
      if (sql.includes("INSERT INTO omni_ai_jobs")) return { rows: [{ id: "job-1" }] };
      return { rows: [] };
    },
  };
}

const suggestJob = {
  job_type: "suggest",
  message_id: "m1",
  conversation_id: "c1",
  channel: "wa",
};

await check("over-budget suggest is not inserted", async () => {
  const pool = costPool(999999);
  const id = await enqueueAiJob(pool, suggestJob);
  assert.equal(id, null);
  assert.equal(pool.calls.some((c) => c.sql.includes("INSERT INTO omni_ai_jobs")), false);
});

await check("over-budget classify is still inserted", async () => {
  const pool = costPool(999999);
  const id = await enqueueAiJob(pool, { ...suggestJob, job_type: "classify" });
  assert.equal(id, "job-1");
  assert.equal(pool.calls.some((c) => c.sql.includes("SUM(cost_usd)")), false);
});

await check("under-budget suggest is inserted", async () => {
  const pool = costPool(0);
  const id = await enqueueAiJob(pool, suggestJob);
  assert.equal(id, "job-1");
});

await check("createDeal rejects an oversized properties blob before insert", async () => {
  const blob = { note: "x".repeat(OMNI_DEAL_PROPERTIES_MAX_BYTES) };
  const pool = { async query() { throw new Error("should not query"); } };
  await assert.rejects(() => createDeal(pool, { contact_id: "c", title: "t", properties: blob }), (err) => err.code === "properties_too_large");
});

await check("updateDeal rejects oversized properties and does not write", async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("SELECT * FROM omni_deals")) {
        return { rows: [{ id: "d1", stage: "lead", closed_at: null, properties: {} }] };
      }
      return { rows: [] };
    },
  };
  const blob = { note: "y".repeat(OMNI_DEAL_PROPERTIES_MAX_BYTES) };
  const result = await updateDeal(pool, "d1", { properties: blob });
  assert.deepEqual(result, { ok: false, error: "properties_too_large" });
  assert.equal(calls.some((sql) => sql.includes("UPDATE omni_deals")), false);
});

await check("rule patch accepts boolean enabled and integer priority", async () => {
  const parsed = automationRulePatchSchema.safeParse({ enabled: false, priority: 3 });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data, { enabled: false, priority: 3 });
});

await check("rule patch rejects a string enabled and a fractional priority", async () => {
  assert.equal(automationRulePatchSchema.safeParse({ enabled: "false" }).success, false);
  assert.equal(automationRulePatchSchema.safeParse({ priority: 1.5 }).success, false);
});

console.log(`\nomniEnqueueGuards: ${passed} passed`);
