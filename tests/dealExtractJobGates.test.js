// Offline. Fake pool, no Postgres. node tests/dealExtractJobGates.test.js
import assert from "node:assert/strict";
import { processExtractDealJob } from "../server/lib/omni/deals/dealExtractor.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function poolFor({ message = null, openDeal = null } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      const compact = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: compact, params });
      if (compact.includes("FROM omni_messages")) return { rows: message ? [message] : [] };
      if (compact.includes("WHERE source_conversation_id")) return { rows: openDeal ? [openDeal] : [] };
      if (compact.includes("SELECT * FROM omni_deals WHERE id")) {
        return { rows: openDeal ? [{ ...openDeal }] : [] };
      }
      if (compact.includes("UPDATE omni_deals")) {
        return { rows: [{ ...openDeal, id: openDeal.id, value_usd: params[2], stage: params[3] }] };
      }
      if (compact.includes("INSERT INTO omni_deals")) {
        return { rows: [{ id: "deal-new", title: params[1], value_usd: params[2], stage: params[3] }] };
      }
      throw new Error(`unexpected sql: ${compact}`);
    },
  };
}

const message = {
  body: "",
  conversation_id: "conv-1",
  channel: "wa",
  contact_id: "contact-1",
  contact_name: "Ana",
};

await check("a missing message does not look for a deal", async () => {
  const pool = poolFor();
  const result = await processExtractDealJob(pool, { message_id: "m-missing" });
  assert.deepEqual(result, { ok: false, error: "message_not_found" });
  assert.equal(pool.calls.length, 1);
  assert.deepEqual(pool.calls[0].params, ["m-missing"]);
});

await check("an open-deal lookup excludes closed stages", async () => {
  const pool = poolFor({
    message: { ...message, body: "hola" },
    openDeal: { id: "deal-1", stage: "qualified", value_usd: 100, closed_at: null },
  });
  await processExtractDealJob(pool, { message_id: "m1" });
  const lookup = pool.calls.find((call) => call.sql.includes("source_conversation_id"));
  assert.match(lookup.sql, /stage NOT IN \('closed_won', 'closed_lost'\)/);
  assert.deepEqual(lookup.params, ["conv-1"]);
});

await check("an existing amount is kept and a non-lead stage is not moved", async () => {
  const pool = poolFor({
    message: { ...message, body: "techo USD 999 pdf" },
    openDeal: { id: "deal-9", stage: "qualified", value_usd: 1500, closed_at: null },
  });
  const result = await processExtractDealJob(pool, { message_id: "m9" });
  assert.equal(result.ok, true);
  assert.equal(result.created, false);
  assert.equal(result.deal_id, "deal-9");
  assert.equal(result.extracted.value_usd, 999);
  assert.equal(result.extracted.stage, "proposal");
  assert.equal(pool.calls.some((call) => call.sql.includes("UPDATE omni_deals")), false);
});

await check("a zero amount is replaced and a lead may advance to qualified", async () => {
  const pool = poolFor({
    message: { ...message, body: "cotizar techo USD 1.500,50" },
    openDeal: { id: "deal-0", stage: "lead", value_usd: 0, closed_at: null },
  });
  const result = await processExtractDealJob(pool, { message_id: "m0" });
  const update = pool.calls.find((call) => call.sql.includes("UPDATE omni_deals"));
  assert.ok(update);
  assert.equal(update.params[0], "deal-0");
  assert.equal(update.params[2], 1500.5);
  assert.equal(update.params[3], "qualified");
  assert.equal(update.params[6], null);
  assert.equal(result.deal_id, "deal-0");
  assert.equal(result.created, false);
});

await check("pdf on a lead drops the amount because proposal is not a legal jump", async () => {
  const pool = poolFor({
    message: { ...message, body: "techo USD 10 pdf" },
    openDeal: { id: "deal-lead", stage: "lead", value_usd: null, closed_at: null },
  });
  const result = await processExtractDealJob(pool, { message_id: "m-pdf" });
  assert.equal(result.ok, true);
  assert.equal(result.created, false);
  assert.equal(result.deal_id, null);
  assert.equal(result.extracted.value_usd, 10);
  assert.equal(result.extracted.stage, "proposal");
  assert.equal(pool.calls.some((call) => call.sql.includes("UPDATE omni_deals")), false);
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO omni_deals")), false);
});

await check("a greeting with no open deal does not create one", async () => {
  const pool = poolFor({ message: { ...message, body: "hola qué tal" } });
  const result = await processExtractDealJob(pool, { message_id: "m-hi" });
  assert.deepEqual(
    { ok: result.ok, created: result.created, deal_id: result.deal_id },
    { ok: true, created: false, deal_id: null },
  );
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO omni_deals")), false);
});

await check("a new quote can be inserted already at proposal", async () => {
  const pool = poolFor({ message: { ...message, body: "techo pdf" } });
  const result = await processExtractDealJob(pool, { message_id: "m-new" });
  const insert = pool.calls.find((call) => call.sql.includes("INSERT INTO omni_deals"));
  assert.ok(insert);
  assert.equal(insert.params[0], "contact-1");
  assert.equal(insert.params[1], "Cotización — Ana");
  assert.equal(insert.params[2], null);
  assert.equal(insert.params[3], "proposal");
  assert.equal(insert.params[4], "wa");
  assert.equal(insert.params[5], "conv-1");
  assert.deepEqual(JSON.parse(insert.params[8]), { created_by: "extract_deal", message_id: "m-new" });
  assert.equal(result.created, true);
  assert.equal(result.deal_id, "deal-new");
});

console.log(`dealExtractJobGates: ${passed} passed`);
