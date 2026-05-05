// ═══════════════════════════════════════════════════════════════════════════
// API tests for the MCP-facing agent routes
//   GET  /api/agent/tools-manifest
//   POST /api/agent/exec-tool
//   GET  /api/agent/tool-stats
//
// Run: node tests/agentMcpRoutes.test.js
// ═══════════════════════════════════════════════════════════════════════════

import http from "node:http";
import express from "express";

// Force a known auth token so the auth-gate test can flip Bearer correctly.
process.env.API_AUTH_TOKEN = "test-token-mcp-routes";
// Force CRM/WhatsApp into "no config" so write tools fall through with a clean error.
process.env.BMC_SHEET_ID = "";
process.env.WHATSAPP_ACCESS_TOKEN = "";
process.env.WHATSAPP_PHONE_NUMBER_ID = "";

const { default: agentChatRouter } = await import("../server/routes/agentChat.js");

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const app = express();
app.use(express.json());
app.use("/api", agentChatRouter);

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ── 1. tools-manifest ────────────────────────────────────────────────────────

await group("GET /api/agent/tools-manifest", async () => {
  const { status, body } = await get("/api/agent/tools-manifest");
  assert(status === 200, "200 OK");
  assert(body?.ok === true, "ok true");
  assert(typeof body.count === "number" && body.count >= 22, `count >= 22 (got ${body?.count})`);
  assert(Array.isArray(body.tools) && body.tools.length === body.count, "tools array length matches count");
  const calc = body.tools.find((t) => t.name === "calcular_cotizacion");
  assert(calc, "calcular_cotizacion present");
  assert(calc?.input_schema?.type === "object", "input_schema is an object schema");
  const guardar = body.tools.find((t) => t.name === "guardar_en_crm");
  assert(guardar?.requires_auth === true, "guardar_en_crm marked requires_auth=true");
  const obtener = body.tools.find((t) => t.name === "obtener_escenarios");
  assert(obtener?.requires_auth === false, "obtener_escenarios marked requires_auth=false");
});

// ── 2. exec-tool — read tool, no auth ────────────────────────────────────────

await group("POST /api/agent/exec-tool — read tool, no auth", async () => {
  const { status, body } = await post("/api/agent/exec-tool", {
    name: "obtener_precio_panel",
    input: { familia: "ISODEC_EPS", espesor: 100, lista: "web" },
  });
  assert(status === 200, "200 OK");
  assert(body?.ok === true, "ok true");
  assert(body.name === "obtener_precio_panel", "name echoed");
  assert(body.result, "result present");
  assert(typeof body.result.precio_usd_m2_sin_iva === "number", "result has price");
});

// ── 3. exec-tool — unknown tool → 404 ────────────────────────────────────────

await group("POST /api/agent/exec-tool — unknown tool → 404", async () => {
  const { status, body } = await post("/api/agent/exec-tool", {
    name: "does_not_exist",
    input: {},
  });
  assert(status === 404, "404 Not Found");
  assert(body?.ok === false, "ok false");
  assert(typeof body.error === "string" && body.error.includes("does_not_exist"), "error mentions tool name");
});

// ── 4. exec-tool — missing name → 400 ────────────────────────────────────────

await group("POST /api/agent/exec-tool — missing name → 400", async () => {
  const { status, body } = await post("/api/agent/exec-tool", { input: {} });
  assert(status === 400, "400 Bad Request");
  assert(body?.ok === false, "ok false");
  assert(typeof body.error === "string" && body.error.toLowerCase().includes("name"), "error mentions name");
});

// ── 5. exec-tool — write tool without auth → 401 ─────────────────────────────

await group("POST /api/agent/exec-tool — write tool without auth → 401", async () => {
  const { status, body } = await post("/api/agent/exec-tool", {
    name: "guardar_en_crm",
    input: { pdf_url: "https://x/p.html", user_confirmed: true },
  });
  assert(status === 401, "401 Unauthorized");
  assert(body?.ok === false, "ok false");
  assert(typeof body.error === "string" && body.error.includes("Bearer"), "error mentions Bearer");
});

// ── 6. exec-tool — write tool with wrong token → 401 ─────────────────────────

await group("POST /api/agent/exec-tool — write tool with wrong token → 401", async () => {
  const { status, body } = await post(
    "/api/agent/exec-tool",
    { name: "guardar_en_crm", input: { pdf_url: "https://x", user_confirmed: true } },
    { Authorization: "Bearer wrong-token" }
  );
  assert(status === 401, "401 with wrong token");
  assert(body?.ok === false, "ok false");
});

// ── 7. exec-tool — write tool with correct token → reaches helper ────────────

await group("POST /api/agent/exec-tool — write tool with valid token reaches helper", async () => {
  const { status, body } = await post(
    "/api/agent/exec-tool",
    { name: "guardar_en_crm", input: { pdf_url: "https://x", user_confirmed: true } },
    { Authorization: "Bearer test-token-mcp-routes" }
  );
  assert(status === 200, "200 OK (route succeeded)");
  // BMC_SHEET_ID is unset in this test env, so the helper returns ok:false with that error.
  assert(body?.ok === true, "exec-tool wrapper reports ok");
  assert(body.result?.ok === false, "underlying tool reports ok false (no sheet)");
  assert(typeof body.result?.error === "string" && body.result.error.includes("BMC_SHEET_ID"), "error from helper, not auth");
});

// ── 8. exec-tool — write tool, valid auth, missing user_confirmed → guard ───

await group("POST /api/agent/exec-tool — write tool with auth but no user_confirmed → guard fires", async () => {
  const { status, body } = await post(
    "/api/agent/exec-tool",
    { name: "guardar_en_crm", input: { pdf_url: "https://x" /* no user_confirmed */ } },
    { Authorization: "Bearer test-token-mcp-routes" }
  );
  assert(status === 200, "200 OK (route succeeded)");
  assert(body.result?.ok === false, "tool returns ok false");
  assert(typeof body.result?.error === "string" && body.result.error.includes("user_confirmed"), "guard error surfaced");
});

// ── 9. tool-stats includes the calls we just made ───────────────────────────

await group("GET /api/agent/tool-stats reflects executions", async () => {
  const { status, body } = await get("/api/agent/tool-stats");
  assert(status === 200, "200 OK");
  assert(body?.ok === true, "ok true");
  assert(typeof body.total_calls === "number" && body.total_calls > 0, "total_calls > 0");
  const guardar = body.tools.find((t) => t.tool === "guardar_en_crm");
  assert(guardar, "guardar_en_crm appears in stats");
  assert(guardar.errors > 0, "guardar_en_crm has errors recorded");
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

server.close();

console.log(`\n${"═".repeat(60)}`);
console.log(`agentMcpRoutes tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) {
  process.exit(1);
}
