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
  sessionKeyFromReq,
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

  const flat = JSON.parse(
    shapeToolResult(
      "calcular_cotizacion",
      JSON.stringify({
        ok: true,
        scenario: "solo_techo",
        subtotalSinIVA: 100,
        iva: 22,
        totalConIVA: 122,
      }),
    ),
  );
  assert.equal(flat.totals?.subtotalSinIVA, 100, "flat subtotalSinIVA nested into totals");
  assert.equal(flat.totals?.totalConIVA, 122);
  assert.equal(flat.totals?.iva, 22);

  const compare = JSON.parse(
    shapeToolResult("comparar_listas", JSON.stringify({ ok: true, subtotalSinIVA: 50, totalConIVA: 61 })),
  );
  assert.equal(compare.totals?.subtotalSinIVA, 50, "comparar_listas uses quote compact");

  const pdf = JSON.parse(
    shapeToolResult("obtener_pdf_html", { ok: true, pdf_id: "p1", html: "<html>SECRET-MARKUP</html>" }),
  );
  assert.equal(pdf.pdf_id, "p1");
  assert.ok(!JSON.stringify(pdf).includes("SECRET-MARKUP"), "voice shape omits raw PDF HTML");
  assert.ok(pdf.html_chars > 0);

  const catalogo = JSON.parse(
    shapeToolResult("obtener_catalogo", {
      lista: "web",
      techo: { ISODEC: { label: "IsoDec", espesores: { 50: {}, 80: {} } } },
    }),
  );
  assert.equal(catalogo.lista, "web");
  assert.equal(catalogo.techo_familias?.[0]?.id, "ISODEC");
  assert.ok(catalogo.note);

  const rawLong = `not-json ${"x".repeat(13000)}`;
  const truncated = shapeToolResult("calcular_cotizacion", rawLong);
  assert.ok(truncated.includes("[truncated"), "invalid JSON over cap is truncated as text");
  assert.ok(!truncated.includes("x".repeat(13000)));
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

  getCalcState("conv-a").scenario = "solo_techo";
  assert.equal(getCalcState("conv-b").scenario, undefined, "sessions do not share calcState");
  setCalcState("conv-b", { scenario: "solo_fachada" });
  assert.equal(getCalcState("conv-a").scenario, "solo_techo");

  setCalcState("conv-a", { listaPrecios: "venta" });
  assert.equal(getCalcState("conv-a").scenario, "solo_techo", "setCalcState merges by default");
  setCalcState("conv-a", { listaPrecios: "web" }, { replace: true });
  assert.equal(getCalcState("conv-a").scenario, undefined, "replace drops prior keys");
  assert.equal(getCalcState("conv-a").listaPrecios, "web");

  assert.equal(
    sessionKeyFromReq({ headers: { "x-conversation-id": "c1", "mcp-session-id": "m1" } }, "t1"),
    "c1",
    "x-conversation-id wins over mcp-session-id",
  );
  assert.equal(
    sessionKeyFromReq({ headers: { "x-elevenlabs-conversation-id": "el1" } }),
    "el1",
  );
  assert.equal(sessionKeyFromReq({ headers: {} }, "transport-9"), "transport-9");
  assert.equal(sessionKeyFromReq({ headers: {} }), "default");
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

    const viaKey = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-secret-abc",
      },
      body: "{}",
    });
    assert.equal(viaKey.status, 200, "x-api-key accepted as Bearer equivalent");

    const wrongKey = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "not-the-secret",
      },
      body: "{}",
    });
    assert.equal(wrongKey.status, 401);

    await new Promise((r) => server.close(r));
  },
);
console.log("ok auth");

await withEnv(
  { PANELI_MCP_SECRET: "", API_AUTH_TOKEN: "", API_KEY: "" },
  async () => {
    const req = { path: "/mcp", headers: { authorization: "Bearer anything" } };
    let status = 0;
    let body = null;
    requirePaneliMcpAuth(
      req,
      {
        status(code) {
          status = code;
          return { json: (j) => { body = j; } };
        },
      },
      () => {
        throw new Error("next must not run without secret");
      },
    );
    assert.equal(status, 503, "missing PANELI_MCP_SECRET → 503");
    assert.equal(body?.error?.code, -32000);
  },
);
console.log("ok auth missing secret");

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

    await new Promise((r) => server.close(r));
  },
);
console.log("ok initialize+tools/list+call");

console.log("\nAll paneliMcp tests passed.");
