#!/usr/bin/env node
/**
 * Smoke: Paneli MCP Streamable HTTP
 *
 * Usage:
 *   PANELI_MCP_SECRET=xxx BMC_API_BASE=http://localhost:3001 npm run smoke:paneli-mcp
 */
const BASE = (process.env.BMC_API_BASE || process.env.PUBLIC_BASE_URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);
const SECRET = String(
  process.env.PANELI_MCP_SECRET || process.env.API_AUTH_TOKEN || process.env.API_KEY || "",
).trim();

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`Paneli MCP smoke → ${BASE}/mcp`);

  const health = await fetch(`${BASE}/mcp/health`);
  if (!health.ok) fail(`/mcp/health HTTP ${health.status}`);
  const healthBody = await health.json();
  console.log("health:", healthBody);
  if (!healthBody.ok || !(healthBody.toolCount > 0)) fail("health missing tools");

  const unauth = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke", version: "0.0.1" },
      },
    }),
  });
  if (unauth.status !== 401 && unauth.status !== 503) {
    fail(`expected 401/503 without secret, got ${unauth.status}`);
  }
  console.log("auth gate:", unauth.status);

  if (!SECRET) {
    console.log("SKIP authenticated calls (no PANELI_MCP_SECRET / API_AUTH_TOKEN)");
    process.exit(0);
  }

  const initRes = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "smoke-paneli-mcp", version: "1.0.0" },
      },
    }),
  });
  const sessionId = initRes.headers.get("mcp-session-id");
  const initText = await initRes.text();
  if (!initRes.ok) fail(`initialize HTTP ${initRes.status}: ${initText.slice(0, 400)}`);
  console.log("initialize ok, session:", sessionId || "(none)");

  // initialized notification (required by some servers)
  if (sessionId) {
    await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
        "Mcp-Session-Id": sessionId,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
  }

  const listRes = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });
  const listText = await listRes.text();
  if (!listRes.ok) fail(`tools/list HTTP ${listRes.status}: ${listText.slice(0, 400)}`);
  let listJson;
  try {
    listJson = JSON.parse(listText);
  } catch {
    // SSE payload
    const dataLine = listText
      .split("\n")
      .find((l) => l.startsWith("data: "));
    listJson = dataLine ? JSON.parse(dataLine.slice(6)) : null;
  }
  const tools = listJson?.result?.tools || [];
  console.log(`tools/list: ${tools.length} tools`);
  const names = new Set(tools.map((t) => t.name));
  for (const need of ["calcular_cotizacion", "obtener_escenarios", "obtener_catalogo", "paneli_mcp_meta"]) {
    if (!names.has(need)) fail(`missing tool ${need}`);
  }

  const callRes = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "obtener_escenarios",
        arguments: {},
      },
    }),
  });
  const callText = await callRes.text();
  if (!callRes.ok) fail(`tools/call HTTP ${callRes.status}: ${callText.slice(0, 400)}`);
  console.log("obtener_escenarios ok,", callText.slice(0, 180).replace(/\s+/g, " "));

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
