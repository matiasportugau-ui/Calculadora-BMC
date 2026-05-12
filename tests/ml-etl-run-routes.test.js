// ═══════════════════════════════════════════════════════════════════════════
// /api/ml/etl-run route regression tests
// Run: node tests/ml-etl-run-routes.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Sets env before dynamic imports so config.js / requireAuth pick up the test
// token. Supabase REST is stubbed via global fetch — no network call is made.

process.env.API_AUTH_TOKEN = "test-auth-token";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const TOKEN = process.env.API_AUTH_TOKEN;

const { default: express } = await import("express");
const { default: createMlEtlRunRouter } = await import(
  "../server/routes/mlEtlRun.js"
);

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

async function run() {
  console.log("\n═══ ML ETL RUN SUITE: /api/ml/etl-run ═══");

  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlString = String(url);
    if (!urlString.startsWith("https://supabase.test/")) {
      return originalFetch(url, options);
    }
    fetchCalls.push({ url: urlString, options });

    if (urlString.includes("order=started_at.desc")) {
      return new Response(
        JSON.stringify([
          {
            id: 42,
            status: "completed",
            products_count: 3,
            listings_count: 9,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (urlString.includes("id=eq.42")) {
      return new Response(
        JSON.stringify([{ id: 42, status: "completed" }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    createMlEtlRunRouter({
      config: { port: 3001, apiAuthToken: TOKEN },
      logger: { warn: () => {} },
    }),
  );

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // ── Auth enforcement ────────────────────────────────────────────────────
    let r = await fetch(`${base}/api/ml/etl-run/latest`);
    assert(
      "GET /api/ml/etl-run/latest without auth → 401",
      r.status === 401,
      r.status,
      401,
    );

    // ── latest maps Supabase row and auth headers ───────────────────────────
    r = await fetch(`${base}/api/ml/etl-run/latest`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    let body = await r.json();
    assert(
      "GET /api/ml/etl-run/latest returns latest run",
      r.status === 200 && body.ok === true && body.run?.id === 42,
      { status: r.status, ok: body.ok, id: body.run?.id },
      { status: 200, ok: true, id: 42 },
    );
    const latestCall = fetchCalls.at(-1);
    assert(
      "latest query uses service role auth headers",
      latestCall?.options?.headers?.apikey === "test-service-role-key" &&
        latestCall?.options?.headers?.Authorization ===
          "Bearer test-service-role-key",
      latestCall?.options?.headers,
      "Supabase REST auth headers",
    );

    // ── specific id happy path ──────────────────────────────────────────────
    r = await fetch(`${base}/api/ml/etl-run/42`, {
      headers: { "x-api-key": TOKEN },
    });
    body = await r.json();
    assert(
      "GET /api/ml/etl-run/:id with x-api-key returns run",
      r.status === 200 && body.ok === true && body.run?.id === 42,
      { status: r.status, ok: body.ok, id: body.run?.id },
      { status: 200, ok: true, id: 42 },
    );
    const idCall = fetchCalls.at(-1);
    assert(
      "id query encodes only the validated decimal id",
      idCall?.url.endsWith(
        "/rest/v1/bmc_price_monitor.etl_runs?select=*&id=eq.42&limit=1",
      ),
      idCall?.url,
      "...id=eq.42&limit=1",
    );

    // ── not found remains explicit ──────────────────────────────────────────
    r = await fetch(`${base}/api/ml/etl-run/999`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    body = await r.json();
    assert(
      "GET /api/ml/etl-run/:id missing row → 404",
      r.status === 404 && body.ok === false,
      { status: r.status, ok: body.ok },
      { status: 404, ok: false },
    );

    // ── strict id validation: no decimal/exponential/coercion forms ─────────
    for (const invalidId of ["0", "-1", "1.5", "1e2", "Infinity", "NaN"]) {
      const before = fetchCalls.length;
      r = await fetch(`${base}/api/ml/etl-run/${encodeURIComponent(invalidId)}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      body = await r.json();
      assert(
        `GET /api/ml/etl-run/${invalidId} → 400 without Supabase call`,
        r.status === 400 && body.ok === false && fetchCalls.length === before,
        { status: r.status, ok: body.ok, fetchCalls: fetchCalls.length - before },
        { status: 400, ok: false, fetchCalls: 0 },
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((res) => server.close(res));
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
