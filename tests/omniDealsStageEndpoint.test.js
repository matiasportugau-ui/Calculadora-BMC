// tests/omniDealsStageEndpoint.test.js — offline coverage for the
// PATCH /api/omni/deals/:id/stage transition contract (mock pg, no server).
// Run: `node tests/omniDealsStageEndpoint.test.js`.
import assert from "node:assert/strict";
import { updateDeal } from "../server/lib/omni/deals/dealService.js";
import { normalizeStage, stageToCrmEstado } from "../server/lib/omni/deals/stageMachine.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function makePool(existingDeal) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("SELECT * FROM omni_deals")) {
        return { rows: existingDeal ? [{ ...existingDeal }] : [] };
      }
      if (sql.includes("UPDATE omni_deals SET")) {
        return {
          rows: [{
            ...existingDeal,
            stage: params[3] || existingDeal.stage,
            closed_at: params[6],
            updated_at: new Date("2026-07-08T12:00:00.000Z").toISOString(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

await check("invalid stage input is rejected before calling the stage patch", async () => {
  assert.equal(normalizeStage("sent_quote"), null);
});

await check("invalid transition returns conflict payload with from/to and does not update", async () => {
  const pool = makePool({
    id: "deal-1",
    contact_id: "contact-1",
    stage: "lead",
    closed_at: null,
    properties: {},
  });
  const result = await updateDeal(pool, "deal-1", { stage: "closed_won" });
  assert.deepEqual(result, {
    ok: false,
    error: "invalid_stage_transition",
    from: "lead",
    to: "closed_won",
  });
  assert.equal(pool.calls.filter((call) => call.sql.includes("UPDATE omni_deals SET")).length, 0);
});

await check("valid terminal transition stamps closed_at and maps to CRM Estado", async () => {
  const pool = makePool({
    id: "deal-2",
    contact_id: "contact-2",
    stage: "negotiation",
    closed_at: null,
    properties: { crm_row_id: "CRM-42" },
  });
  const result = await updateDeal(pool, "deal-2", { stage: "closed_won" });
  assert.equal(result.ok, true);
  assert.equal(result.deal.stage, "closed_won");
  assert.ok(result.deal.closed_at, "closed_at is stamped for terminal stages");
  assert.equal(stageToCrmEstado(result.deal.stage), "Cerrado ganado");
});

await check("missing deal returns deal_not_found", async () => {
  const result = await updateDeal(makePool(null), "missing", { stage: "qualified" });
  assert.deepEqual(result, { ok: false, error: "deal_not_found" });
});

console.log(`\nomni deals stage endpoint contract: ${passed} checks passed`);
