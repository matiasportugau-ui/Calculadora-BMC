/**
 * Paneli MCP unit tests — auth, deny list, voice shape, schema, router health.
 */
import assert from "node:assert/strict";
import express from "express";
import { createMcpRouter } from "../server/routes/mcp.js";
import { requirePaneliMcpAuth, getPaneliMcpSecret } from "../server/mcp/auth.js";
import { resolveDenyList, DEFAULT_WRITE_DENY } from "../server/mcp/denyList.js";
import { shapeToolResult } from "../server/mcp/voiceShape.js";
import {
  anthropicSchemaToZodShape,
  normalizeToolArgs,
  schemaSummary,
} from "../server/mcp/schemaAdapter.js";
import { createPaneliMcpServer, listPaneliMcpToolNames } from "../server/mcp/paneliMcpServer.js";
import {
  getCalcState,
  setCalcState,
  safeAssignCalcState,
  _resetConversationStateForTests,
} from "../server/mcp/conversationState.js";

async function withEnv(overrides, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(overrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
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

// ── deny list ──────────────────────────────────────────────────────────────
await withEnv({ PANELI_MCP_ALLOW_WRITES: undefined, PANELI_MCP_DENY_TOOLS: "" }, () => {
  const { denied, allowWrites } = resolveDenyList();
  assert.equal(allowWrites, false);
  assert.ok(denied.has("guardar_en_crm"));
  assert.ok(denied.has("enviar_whatsapp_link"));
  assert.ok(DEFAULT_WRITE_DENY.length > 5);
});

await withEnv({ PANELI_MCP_ALLOW_WRITES: "1", PANELI_MCP_DENY_TOOLS: "obtener_catalogo" }, () => {
  const { denied, allowWrites } = resolveDenyList();
  assert.equal(allowWrites, true);
  assert.ok(denied.has("obtener_catalogo"));
  assert.ok(!denied.has("guardar_en_crm"));
});
console.log("ok denyList");

// ── voice shape ────────────────────────────────────────────────────────────
{
  const compact = shapeToolResult(
    "calcular_cotizacion",
    JSON.stringify({
      ok: true,
      scenario: "solo_techo",
      totals: { totalFinal: 1234 },
      bom: [{ title: "PANELES", items: [{ label: "IsoDec", cant: 10, total: 500 }] }],
      textoWhatsApp: "x".repeat(2000),
    }),
  );
  const parsed = JSON.parse(compact);
  assert.equal(parsed.totals.totalFinal, 1234);
  assert.ok(parsed.bom_groups?.[0]?.title === "PANELES");
  assert.ok(parsed.textoWhatsApp.length < 2000);

  const informe = JSON.parse(
    shapeToolResult("obtener_informe_completo", JSON.stringify({ lista: "web", asesoria: { a: 1, b: 2 } })),
  );
  assert.ok(informe.note);
  console.log("ok voiceShape");
}

// ── schema adapter ─────────────────────────────────────────────────────────
{
  const shape = anthropicSchemaToZodShape({
    type: "object",
    properties: {
      scenario: { type: "string", enum: ["solo_techo", "solo_fachada"] },
      flete: { type: "number" },
      techo: { type: "object" },
    },
    required: ["scenario"],
  });
  assert.ok(shape.scenario);
  assert.ok(shape.flete);
  const merged = normalizeToolArgs({ scenario: "solo_techo", input: { flete: 10 } });
  assert.equal(merged.scenario, "solo_techo");
  assert.equal(merged.flete, 10);
  assert.ok(schemaSummary({ properties: { a: {}, b: {} }, required: ["a"] }).includes("a*"));
  console.log("ok schemaAdapter");
}

// ── conversation state ─────────────────────────────────────────────────────
{
  _resetConversationStateForTests();
  const s = getCalcState("t1");
  s.scenario = "solo_techo";
  assert.equal(getCalcState("t1").scenario, "solo_techo");
  setCalcState("t1", { listaPrecios: "web" });
  assert.equal(getCalcState("t1").listaPrecios, "web");

  // Isolation: distinct keys must not share state
  setCalcState("t2", { scenario: "solo_fachada" });
  assert.equal(getCalcState("t1").scenario, "solo_techo");
  assert.equal(getCalcState("t2").scenario, "solo_fachada");

  // Empty key must throw (no silent "default" bucket)
  assert.throws(() => getCalcState(""), /sessionKey is required/);
  assert.throws(() => setCalcState(undefined, { a: 1 }), /sessionKey is required/);

  // Remote property injection: __proto__ / constructor must not land on state
  const victim = Object.create(null);
  safeAssignCalcState(victim, JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}},"scenario":"ok"}'));
  assert.equal(victim.scenario, "ok");
  assert.equal(Object.prototype.hasOwnProperty.call(victim, "__proto__"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(victim, "constructor"), false);
  assert.equal({}.polluted, undefined);

  setCalcState("t-proto", JSON.parse('{"__proto__":{"pwned":true},"techo":{"largo":12}}'), {
    replace: true,
  });
  const after = getCalcState("t-proto");
  assert.equal(after.techo.largo, 12);
  assert.equal(Object.prototype.hasOwnProperty.call(after, "__proto__"), false);
  assert.equal({}.pwned, undefined);

  console.log("ok conversationState");
}

// ── server factory registers tools ─────────────────────────────────────────
await withEnv({ PANELI_MCP_ALLOW_WRITES: undefined, PANELI_MCP_DENY_TOOLS: "" }, () => {
  const names = listPaneliMcpToolNames();
  assert.ok(names.includes("calcular_cotizacion"));
  assert.ok(!names.includes("guardar_en_crm"));
  const { meta } = createPaneliMcpServer({ sessionKey: "test" });
  assert.ok(meta.registered >= 10);
  assert.ok(meta.skipped.includes("guardar_en_crm"));
});
console.log("ok paneliMcpServer factory");

// ── auth middleware ────────────────────────────────────────────────────────
await withEnv(
  { PANELI_MCP_SECRET: "test-secret-abc", API_AUTH_TOKEN: "", API_KEY: "" },
  async () => {
    assert.equal(getPaneliMcpSecret(), "test-secret-abc");
    const app = express();
    app.use(express.json());
    app.use("/mcp", requirePaneliMcpAuth);
    app.post("/mcp", (_req, res) => res.json({ ok: true }));

    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    const healthReq = { path: "/health", headers: {} };
    let nextCalled = false;
    requirePaneliMcpAuth(healthReq, { status: () => ({ json: () => {} }) }, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);

    const denied = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(denied.status, 401);

    const ok = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-secret-abc",
      },
      body: "{}",
    });
    assert.equal(ok.status, 200);

    await new Promise((r) => server.close(r));
  },
);
console.log("ok auth");

// ── router /mcp/health (no secret) ─────────────────────────────────────────
{
  const app = express();
  app.use(express.json());
  app.use("/mcp", createMcpRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/mcp/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.toolCount > 0);
  assert.equal(body.transport, "streamable-http");

  // unauth initialize → 401
  process.env.PANELI_MCP_SECRET = process.env.PANELI_MCP_SECRET || "unit-test-secret";
  const unauth = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    }),
  });
  assert.ok(unauth.status === 401 || unauth.status === 503);

  await new Promise((r) => server.close(r));
  console.log("ok router health");
}

// ── initialize + tools/list (Streamable HTTP) ──────────────────────────────
await withEnv(
  { PANELI_MCP_SECRET: "init-secret-xyz", API_AUTH_TOKEN: "", API_KEY: "" },
  async () => {
    _resetConversationStateForTests();
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    app.use("/mcp", createMcpRouter());
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer init-secret-xyz",
      Accept: "application/json, text/event-stream",
    };

    async function initializeSession() {
      const initRes = await fetch(`${base}/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "unit", version: "0" },
          },
        }),
      });
      assert.equal(initRes.status, 200, await initRes.clone().text());
      const sessionId = initRes.headers.get("mcp-session-id");
      assert.ok(sessionId, "expected Mcp-Session-Id header");
      await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { ...headers, "Mcp-Session-Id": sessionId },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      });
      return sessionId;
    }

    const sessionId = await initializeSession();

    const listRes = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...headers, "Mcp-Session-Id": sessionId },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    assert.equal(listRes.status, 200, await listRes.clone().text());
    const listBody = await listRes.json();
    const tools = listBody?.result?.tools || [];
    assert.ok(tools.length >= 10, `expected tools, got ${tools.length}`);
    assert.ok(tools.some((t) => t.name === "calcular_cotizacion"));

    const callRes = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...headers, "Mcp-Session-Id": sessionId },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "obtener_escenarios", arguments: {} },
      }),
    });
    assert.equal(callRes.status, 200, await callRes.clone().text());
    const callBody = await callRes.json();
    assert.ok(callBody?.result?.content?.[0]?.text);

    // Two concurrent initializes without X-Conversation-Id must NOT share calcState
    const sidA = await initializeSession();
    const sidB = await initializeSession();
    assert.notEqual(sidA, sidB);

    await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...headers, "Mcp-Session-Id": sidA },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "aplicar_estado_calc",
          arguments: { scenario: "solo_techo", techo: { largo: 99, ancho: 8 } },
        },
      }),
    });
    await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...headers, "Mcp-Session-Id": sidB },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "aplicar_estado_calc",
          arguments: { scenario: "solo_fachada", pared: { alto: 3 } },
        },
      }),
    });

    // Hitchhiking via client X-Conversation-Id must not merge stores:
    // a third session claiming the same conversation header still gets its own key.
    const initC = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...headers, "X-Conversation-Id": "shared-client-id" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 20,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "c", version: "0" },
        },
      }),
    });
    assert.equal(initC.status, 200);
    const sidC = initC.headers.get("mcp-session-id");
    const initD = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...headers, "X-Conversation-Id": "shared-client-id" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 21,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "d", version: "0" },
        },
      }),
    });
    assert.equal(initD.status, 200);
    const sidD = initD.headers.get("mcp-session-id");
    assert.notEqual(sidC, sidD);

    await new Promise((r) => server.close(r));
  },
);
console.log("ok initialize+tools/list+call+sessionIsolation");

// ── prod auth: no API_AUTH_TOKEN fallback ──────────────────────────────────
await withEnv(
  {
    PANELI_MCP_SECRET: undefined,
    API_AUTH_TOKEN: "shared-api-token",
    API_KEY: "",
    NODE_ENV: "production",
    K_SERVICE: "panelin-calc",
  },
  () => {
    assert.equal(getPaneliMcpSecret(), "");
  },
);
await withEnv(
  {
    PANELI_MCP_SECRET: undefined,
    API_AUTH_TOKEN: "shared-api-token",
    API_KEY: "",
    NODE_ENV: "development",
    K_SERVICE: undefined,
  },
  () => {
    assert.equal(getPaneliMcpSecret(), "shared-api-token");
  },
);
console.log("ok auth prod isolation");

console.log("\nAll paneliMcp tests passed.");
