// ═══════════════════════════════════════════════════════════════════════════
// Security/regression checks for route parameter handling.
// Run: node tests/security-route-params.test.js
// ═══════════════════════════════════════════════════════════════════════════

process.env.API_AUTH_TOKEN = "test-auth-token";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const TOKEN = process.env.API_AUTH_TOKEN;

const { default: express } = await import("express");
const { default: createMlEtlRunRouter } = await import("../server/routes/mlEtlRun.js");
const { parseWaQuotesLimit } = await import("../server/routes/wa.js");

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(
    `  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`,
  );
  failed += 1;
}

async function runMlEtlRouteChecks() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return new Response(JSON.stringify([{ id: 42, status: "completed" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const app = express();
  app.use(
    createMlEtlRunRouter({
      config: { port: 3001 },
      logger: { warn: () => {} },
    }),
  );

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const request = originalFetch;

  try {
    let r = await request(`${base}/api/ml/etl-run/abc`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    let body = await r.json();
    assert(
      "GET /api/ml/etl-run/:id rejects non-numeric id before Supabase",
      r.status === 400 && body.ok === false && calls.length === 0,
      { status: r.status, body, calls: calls.length },
      { status: 400, calls: 0 },
    );

    r = await request(`${base}/api/ml/etl-run/42`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    body = await r.json();
    const supabaseUrl = calls[0]?.url || "";
    assert(
      "GET /api/ml/etl-run/:id uses encoded PostgREST filters",
      r.status === 200 &&
        body.ok === true &&
        supabaseUrl.includes("select=*") &&
        supabaseUrl.includes("id=eq.42") &&
        supabaseUrl.includes("limit=1"),
      { status: r.status, body, supabaseUrl },
      { status: 200, filters: ["select=*", "id=eq.42", "limit=1"] },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = originalFetch;
  }
}

async function run() {
  console.log("\n═══ SECURITY ROUTE PARAM SUITE ═══");

  assert("WA quotes limit defaults invalid input to 20", parseWaQuotesLimit("abc") === 20, parseWaQuotesLimit("abc"), 20);
  assert("WA quotes limit clamps high input to 100", parseWaQuotesLimit("999") === 100, parseWaQuotesLimit("999"), 100);
  assert("WA quotes limit clamps low input to 1", parseWaQuotesLimit("-5") === 1, parseWaQuotesLimit("-5"), 1);

  await runMlEtlRouteChecks();

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
