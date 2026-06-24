// ═══════════════════════════════════════════════════════════════════════════
// Auth gate regressions for sensitive routes
// Run: node tests/auth-routes.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Sets API_AUTH_TOKEN before dynamic-importing routers so config.js picks it up.
// The voice/session 401 path short-circuits before any OpenAI fetch, so no
// network mocks are required.

process.env.API_AUTH_TOKEN = "test-auth-token";
process.env.OPENAI_API_KEY = "sk-test-fake";

const TOKEN = process.env.API_AUTH_TOKEN;

const { default: express } = await import("express");
const { default: calcRouter } = await import("../server/routes/calc.js");
const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const { config } = await import("../server/config.js");
const { createSuperAgentRouter } = await import("../server/routes/superAgent.js");
const { createWolfboardRouter } = await import("../server/routes/wolfboard.js");

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

async function run() {
  console.log("\n═══ AUTH SUITE: Sensitive route gating ═══");

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/calc", calcRouter);
  app.use("/api", agentVoiceRouter);
  app.use("/api/agent", createSuperAgentRouter(config));
  app.use("/api/wolfboard", createWolfboardRouter(config));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // ── /calc/interaction-log/list ───────────────────────────────────────────
    let r = await fetch(`${base}/calc/interaction-log/list`);
    assert(
      "GET /calc/interaction-log/list without auth → 401",
      r.status === 401,
      r.status,
      401
    );

    r = await fetch(`${base}/calc/interaction-log/list`, {
      headers: { "x-api-key": TOKEN },
    });
    let body = await r.json();
    assert(
      "GET /calc/interaction-log/list with x-api-key → 200",
      r.status === 200 && body.ok === true,
      { status: r.status, ok: body.ok },
      { status: 200, ok: true }
    );

    r = await fetch(`${base}/calc/interaction-log/list`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert(
      "GET /calc/interaction-log/list with Bearer → 200",
      r.status === 200,
      r.status,
      200
    );

    // ── /calc/interaction-log/file/:name ─────────────────────────────────────
    r = await fetch(`${base}/calc/interaction-log/file/interaction-doesnotexist.json`);
    assert(
      "GET /calc/interaction-log/file/:name without auth → 401",
      r.status === 401,
      r.status,
      401
    );

    // ── POST /api/agent/voice/session ────────────────────────────────────────
    r = await fetch(`${base}/api/agent/voice/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devMode: false }),
    });
    body = await r.json().catch(() => ({}));
    assert(
      "POST /api/agent/voice/session without auth → 401",
      r.status === 401 && body.ok === false,
      { status: r.status, ok: body.ok },
      { status: 401, ok: false }
    );

    r = await fetch(`${base}/api/agent/voice/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "wrong-token" },
      body: JSON.stringify({ devMode: false }),
    });
    assert(
      "POST /api/agent/voice/session with wrong token → 401",
      r.status === 401,
      r.status,
      401
    );

    // ── Legacy routers must fail closed if service token is not configured ──
    const previousToken = config.apiAuthToken;
    config.apiAuthToken = "";
    try {
      r = await fetch(`${base}/api/wolfboard/pendientes`);
      body = await r.json().catch(() => ({}));
      assert(
        "GET /api/wolfboard/pendientes with missing API_AUTH_TOKEN → 401 (JWT or token required)",
        r.status === 401 && body.error === "missing_credentials",
        { status: r.status, error: body.error },
        { status: 401, error: "missing_credentials" }
      );

      r = await fetch(`${base}/api/agent/quote-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta: "Necesito cotizar un techo de 10 por 12 metros" }),
      });
      body = await r.json().catch(() => ({}));
      assert(
        "POST /api/agent/quote-lead with missing API_AUTH_TOKEN → 503",
        r.status === 503 && body.error === "API_AUTH_TOKEN not configured",
        { status: r.status, error: body.error },
        { status: 503, error: "API_AUTH_TOKEN not configured" }
      );
    } finally {
      config.apiAuthToken = previousToken;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`AUTH RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

await run();
