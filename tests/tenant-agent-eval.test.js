import test from "node:test";
import assert from "node:assert/strict";
import {
  conversationsToCsv,
  isBmcProdOrigin,
  isValidConversationId,
  normalizeTenantSlug,
  recordTenantChatTurn,
  resolveTenantSlug,
  tenantSlugFromOrigin,
  personaLine,
} from "../server/lib/tenantAgentEval.js";
import { estimateCostUSD } from "../server/lib/aiProviderConfig.js";

test("slug allowlist and origin mapping", () => {
  assert.equal(normalizeTenantSlug("BC"), "bc");
  assert.equal(normalizeTenantSlug("nope"), null);
  assert.equal(tenantSlugFromOrigin("https://calculadora-bc.vercel.app"), "bc");
  assert.equal(tenantSlugFromOrigin("https://calculadora-paneleslam.vercel.app"), "paneleslam");
  assert.equal(tenantSlugFromOrigin("https://calculadora-smartbuilding.vercel.app"), "smartbuilding");
  assert.equal(tenantSlugFromOrigin("https://calculadora-bmc.vercel.app"), null);
  assert.equal(isBmcProdOrigin("https://calculadora-bmc.vercel.app"), true);
});

test("resolve prefers Origin host over foreign membership (shared Cloud Run silo)", () => {
  // BC invitee on LAM Origin must resolve as paneleslam, not bc.
  assert.equal(resolveTenantSlug({
    membershipSlug: "bc",
    bodyTenant: "bc",
    origin: "https://calculadora-paneleslam.vercel.app",
  }), "paneleslam");
  assert.equal(resolveTenantSlug({
    membershipSlug: "paneleslam",
    bodyTenant: "bc",
    origin: "https://calculadora-bc.vercel.app",
  }), "bc");
  assert.equal(resolveTenantSlug({
    bodyTenant: "bc",
    origin: "https://calculadora-bmc.vercel.app",
  }), null);
  assert.equal(resolveTenantSlug({
    envSlug: "bc",
    origin: "https://calculadora-bmc.vercel.app",
  }), null);
  assert.equal(resolveTenantSlug({
    bodyTenant: "bc",
    origin: "http://localhost:5173",
  }), "bc");
  assert.equal(resolveTenantSlug({
    origin: "https://calculadora-smartbuilding.vercel.app",
  }), "smartbuilding");
});

test("persona line is tenant-safe", () => {
  assert.match(personaLine(null), /Panelin/);
  assert.match(personaLine("bc"), /JenIA/);
  assert.doesNotMatch(personaLine("bc"), /^Sos Panelin/);
  assert.match(personaLine("smartbuilding"), /Basuuuu IA/);
});

test("recordTenantChatTurn upserts one slug and sums tokens", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const cid = "11111111-1111-4111-8111-111111111111";
  const r = await recordTenantChatTurn({
    pool,
    conversationId: cid,
    tenantSlug: "bc",
    role: "assistant",
    content: "Te armo el techo",
    turnIndex: 1,
    provider: "gemini",
    model: "gemini-2.5-flash",
    inputTokens: 1000,
    outputTokens: 200,
  });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params[1], "bc");
  assert.equal(calls[0].params[2], "JenIA");
  const usd = estimateCostUSD("gemini", "gemini-2.5-flash", {
    input_tokens: 1000,
    output_tokens: 200,
  });
  assert.equal(calls[0].params[9], usd);
  assert.match(calls[0].sql, /tenant_agent_conversations/);
  assert.match(calls[1].sql, /tenant_agent_turns/);
});

test("recordTenantChatTurn refuses BMC and other slugs", async () => {
  const pool = { query: async () => ({ rows: [] }) };
  const cid = "11111111-1111-4111-8111-111111111111";
  assert.equal((await recordTenantChatTurn({
    pool, conversationId: cid, tenantSlug: null, role: "user", content: "x", turnIndex: 0,
  })).skipped, "not_tenant");
  assert.equal((await recordTenantChatTurn({
    pool, conversationId: cid, tenantSlug: "bmc", role: "user", content: "x", turnIndex: 0,
  })).skipped, "not_tenant");
});

test("conversation uuid check", () => {
  assert.equal(isValidConversationId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isValidConversationId("nope"), false);
});

test("csv export has token columns and no factory cost", () => {
  const csv = conversationsToCsv([{
    conversation_id: "c1",
    tenant_slug: "bc",
    agent_name: "JenIA",
    user_email: "a@b.com",
    turn_count: 2,
    input_tokens: 10,
    output_tokens: 5,
    estimated_cost_usd: 0.001,
  }]);
  assert.match(csv, /JenIA/);
  assert.match(csv, /input_tokens/);
  assert.doesNotMatch(csv, /factory_cost|comision/);
});
