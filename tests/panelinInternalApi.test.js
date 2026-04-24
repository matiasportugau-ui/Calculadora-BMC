// ═══════════════════════════════════════════════════════════════════════════
// E2E API tests — Panelin Internal RBAC routes
// Run: node tests/panelinInternalApi.test.js
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import createPanelinInternalRouter from "../server/routes/panelinInternal.js";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed += 1;
  }
}

async function run() {
  console.log("\n═══ SUITE: panelinInternal E2E API ═══");

  const TEST_TOKEN = "test-token-e2e-rbac-suite";
  const config = { apiAuthToken: TEST_TOKEN, port: 0 };

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/internal/panelin", createPanelinInternalRouter(config));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api/internal/panelin`;

  const get = async (path, headers = {}) => {
    const res = await fetch(`${base}${path}`, { headers });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  const post = async (path, body, headers = {}) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  const auth = { Authorization: `Bearer ${TEST_TOKEN}` };
  const noAuth = {};

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    let r = await get("/whoami", noAuth);
    assert("GET /whoami sin token → 401 o 503", r.status === 401 || r.status === 503, r.status, "401|503");

    r = await get("/whoami", auth);
    assert("GET /whoami con token → 200", r.status === 200, r.status, 200);
    assert("GET /whoami → ok: true", r.json?.ok === true, r.json?.ok, true);
    assert("GET /whoami → role existe", typeof r.json?.role === "string", typeof r.json?.role, "string");
    assert("GET /whoami → roles_defined is array", Array.isArray(r.json?.roles_defined), r.json?.roles_defined, "array");
    assert("GET /whoami → dashboard_access_sample is array", Array.isArray(r.json?.dashboard_access_sample), null, "array");

    // ── Rol via header ────────────────────────────────────────────────────
    r = await get("/whoami", { ...auth, "X-Panelin-Role": "ventas" });
    assert("GET /whoami X-Panelin-Role:ventas → role=ventas", r.json?.role === "ventas", r.json?.role, "ventas");

    r = await get("/whoami", { ...auth, "X-Panelin-Role": "admin" });
    assert("GET /whoami X-Panelin-Role:admin → role=admin", r.json?.role === "admin", r.json?.role, "admin");

    r = await get("/whoami", { ...auth, "X-Panelin-Role": "rol-invalido" });
    // rol inválido cae al default (director) según implementación
    assert("GET /whoami X-Panelin-Role:invalido → ok:true (usa default)", r.json?.ok === true, r.json?.ok, true);

    // ── /tools ────────────────────────────────────────────────────────────
    r = await get("/tools", noAuth);
    assert("GET /tools sin token → 401 o 503", r.status === 401 || r.status === 503, r.status, "401|503");

    r = await get("/tools", auth);
    assert("GET /tools → 200", r.status === 200, r.status, 200);
    assert("GET /tools → ok:true", r.json?.ok === true, r.json?.ok, true);
    assert("GET /tools → tools is array", Array.isArray(r.json?.tools), r.json?.tools, "array");
    assert("GET /tools → tools not empty", (r.json?.tools?.length ?? 0) > 0, r.json?.tools?.length, ">0");
    assert("GET /tools → schema_version exists", typeof r.json?.schema_version === "string", typeof r.json?.schema_version, "string");

    // ── /policies ────────────────────────────────────────────────────────
    r = await get("/policies", noAuth);
    assert("GET /policies sin token → 401 o 503", r.status === 401 || r.status === 503, r.status, "401|503");

    r = await get("/policies", auth);
    assert("GET /policies → 200", r.status === 200, r.status, 200);
    assert("GET /policies → ok:true", r.json?.ok === true, r.json?.ok, true);
    assert("GET /policies → policies is array", Array.isArray(r.json?.policies), r.json?.policies, "array");
    assert("GET /policies → al menos una política", (r.json?.policies?.length ?? 0) > 0, r.json?.policies?.length, ">0");
    const pol = r.json?.policies?.[0];
    assert("GET /policies → política tiene method+path+minRole", pol?.method && pol?.path && pol?.minRole, pol, "policy obj");

    // ── /invoke ──────────────────────────────────────────────────────────
    r = await post("/invoke", { tool_id: "api_cotizaciones_get" }, noAuth);
    assert("POST /invoke sin token → 401 o 503", r.status === 401 || r.status === 503, r.status, "401|503");

    r = await post("/invoke", {}, auth);
    assert("POST /invoke tool_id vacío → 400", r.status === 400, r.status, 400);
    assert("POST /invoke tool_id vacío → ok:false", r.json?.ok === false, r.json?.ok, false);

    r = await post("/invoke", { tool_id: "tool-que-no-existe-xyz" }, auth);
    assert("POST /invoke tool desconocido → 400", r.status === 400, r.status, 400);

    // ventas puede invocar api_cotizaciones_get
    r = await post("/invoke", { tool_id: "api_cotizaciones_get" }, { ...auth, "X-Panelin-Role": "ventas" });
    // el tool hace fetch interno; puede fallar con 502 si Sheets no disponible, pero NO debe ser 401/403/400
    assert(
      "POST /invoke api_cotizaciones_get (ventas) → no es 401/403/400",
      r.status !== 401 && r.status !== 403 && r.status !== 400,
      r.status, "200 o 502"
    );

    // ventas NO puede invocar api_cotizaciones_post (min_role=admin)
    r = await post("/invoke", { tool_id: "api_cotizaciones_post" }, { ...auth, "X-Panelin-Role": "ventas" });
    assert("POST /invoke api_cotizaciones_post (ventas) → 403", r.status === 403, r.status, 403);
    assert("POST /invoke api_cotizaciones_post (ventas) → ok:false", r.json?.ok === false, r.json?.ok, false);

    // admin puede invocar api_cotizaciones_post
    r = await post("/invoke", { tool_id: "api_cotizaciones_post" }, { ...auth, "X-Panelin-Role": "admin" });
    assert(
      "POST /invoke api_cotizaciones_post (admin) → no es 401/403",
      r.status !== 401 && r.status !== 403,
      r.status, "200 o 502"
    );

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("");
  console.log(`════════════════════════════════════════════`);
  console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`════════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
