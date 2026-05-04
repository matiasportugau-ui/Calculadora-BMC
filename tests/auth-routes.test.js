// ═══════════════════════════════════════════════════════════════════════════
// Auth gate regressions for sensitive routes
// Run: node tests/auth-routes.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Sets API_AUTH_TOKEN before dynamic-importing routers so config.js picks it up.
// The voice/session 401 path short-circuits before any OpenAI fetch. Google
// userinfo is mocked below to keep auth route tests deterministic.

process.env.API_AUTH_TOKEN = "test-auth-token";
process.env.OPENAI_API_KEY = "sk-test-fake";

const TOKEN = process.env.API_AUTH_TOKEN;

const { default: express } = await import("express");
const { default: calcRouter } = await import("../server/routes/calc.js");
const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const { default: authGoogleRouter } = await import("../server/routes/authGoogle.js");

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
  app.use("/api", authGoogleRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const realFetch = globalThis.fetch;

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

    // ── POST /api/auth/google ───────────────────────────────────────────────
    globalThis.fetch = async () => {
      throw new Error("userinfo should not be called for invalid bodies");
    };
    r = await realFetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    body = await r.json();
    assert(
      "POST /api/auth/google missing accessToken → 400",
      r.status === 400 && body.ok === false,
      { status: r.status, ok: body.ok },
      { status: 400, ok: false }
    );

    let userinfoAuth = null;
    globalThis.fetch = async (_url, opts = {}) => {
      userinfoAuth = opts.headers?.Authorization;
      return new Response(JSON.stringify({
        sub: "google-sub-123",
        email: "ventas@bmc.test",
        email_verified: true,
        name: "Ventas BMC",
        picture: "https://example.test/avatar.png",
        locale: "es-419",
        ignored: "not returned",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
    r = await realFetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "ya29.test-token" }),
    });
    body = await r.json();
    assert(
      "POST /api/auth/google success maps trusted user fields",
      r.status === 200 &&
        body.ok === true &&
        body.user?.sub === "google-sub-123" &&
        body.user?.emailVerified === true &&
        body.user?.ignored === undefined &&
        userinfoAuth === "Bearer ya29.test-token",
      { status: r.status, body, userinfoAuth },
      { status: 200, ok: true, emailVerified: true }
    );

    globalThis.fetch = async () => new Response("invalid token body", { status: 403 });
    r = await realFetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "bad-token" }),
    });
    body = await r.json();
    assert(
      "POST /api/auth/google userinfo non-OK → 401",
      r.status === 401 && body.ok === false && body.error === "userinfo 403",
      { status: r.status, body },
      { status: 401, error: "userinfo 403" }
    );

    globalThis.fetch = async () => new Response(JSON.stringify({ email: "missing-sub@test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    r = await realFetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "token-without-sub" }),
    });
    body = await r.json();
    assert(
      "POST /api/auth/google userinfo without sub → 401",
      r.status === 401 && body.ok === false,
      { status: r.status, body },
      { status: 401, ok: false }
    );

    globalThis.fetch = async () => {
      throw new Error("network unavailable");
    };
    r = await realFetch(`${base}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "network-token" }),
    });
    body = await r.json();
    assert(
      "POST /api/auth/google userinfo network failure → 502",
      r.status === 502 && body.ok === false && body.error === "userinfo fetch failed",
      { status: r.status, body },
      { status: 502, error: "userinfo fetch failed" }
    );
  } finally {
    globalThis.fetch = realFetch;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`AUTH RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

await run();
