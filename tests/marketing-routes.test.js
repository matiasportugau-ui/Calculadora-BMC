// ═══════════════════════════════════════════════════════════════════════════
// /api/marketing/* graceful-degradation route tests
// Run: node tests/marketing-routes.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Sets API_AUTH_TOKEN before importing the router so the requireServiceOrUser({ role: 'admin' }) guard
// accepts the static service token. DATABASE_URL is intentionally unset: the
// market-intel pool throws "DATABASE_URL required", which the read routes must
// treat as "not provisioned yet" and answer with an empty 200 payload (never a
// dead-end 503 the operator can't retry away). No database or network is touched.

process.env.API_AUTH_TOKEN = "test-auth-token";
delete process.env.DATABASE_URL;

const TOKEN = process.env.API_AUTH_TOKEN;

const { default: express } = await import("express");
const { default: marketingRouter } = await import("../server/routes/marketing.js");
const { isNotProvisioned, NO_DATABASE_URL } = await import(
  "../server/lib/marketIntel/db.js"
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
  console.log("\n═══ MARKETING SUITE: /api/marketing/* ═══");

  // ── unit: isNotProvisioned classifies "not provisioned" vs everything else ──
  // (the SQLSTATE branch is the real prod cause but needs no live DB to assert).
  for (const code of [NO_DATABASE_URL, "42P01", "42703", "3F000", "3D000"]) {
    assert(
      `isNotProvisioned({code:'${code}'}) → true`,
      isNotProvisioned({ code }) === true,
      isNotProvisioned({ code }),
      true,
    );
  }
  for (const [label, sample] of [
    ["ECONNREFUSED (connection refused)", { code: "ECONNREFUSED" }],
    ["57P01 (admin_shutdown)", { code: "57P01" }],
    ["42501 (insufficient_privilege)", { code: "42501" }],
    ["untagged Error('DATABASE_URL required') — message no longer matched", new Error("DATABASE_URL required")],
    ["empty object", {}],
    ["null", null],
    ["undefined", undefined],
  ]) {
    assert(
      `isNotProvisioned: ${label} → false`,
      isNotProvisioned(sample) === false,
      isNotProvisioned(sample),
      false,
    );
  }

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/marketing", marketingRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // ── Auth enforcement ────────────────────────────────────────────────────
    let r = await fetch(`${base}/api/marketing/dashboard/summary`);
    assert(
      "GET /dashboard/summary without auth → 401",
      r.status === 401,
      r.status,
      401,
    );

    // ── summary degrades to an empty 200 when the DB is not provisioned ──────
    r = await fetch(`${base}/api/marketing/dashboard/summary`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    let body = await r.json();
    assert(
      "GET /dashboard/summary not provisioned → 200 empty payload",
      r.status === 200 &&
        body.provisioned === false &&
        body.last_etl_run === null &&
        body.alert_counts?.info === 0 &&
        body.alert_counts?.warning === 0 &&
        body.alert_counts?.critical === 0 &&
        Array.isArray(body.top_competitors_by_delta) &&
        body.top_competitors_by_delta.length === 0 &&
        body.pending_mystery_shopping_count === 0,
      { status: r.status, provisioned: body.provisioned },
      { status: 200, provisioned: false },
    );

    // ── paginated read endpoints degrade to empty 200 too ───────────────────
    for (const path of [
      "/api/marketing/dashboard/competitors",
      "/api/marketing/dashboard/alerts",
      "/api/marketing/mystery-shopping",
    ]) {
      r = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      body = await r.json();
      assert(
        `GET ${path} not provisioned → 200 empty page`,
        r.status === 200 &&
          body.provisioned === false &&
          Array.isArray(body.data) &&
          body.data.length === 0 &&
          body.total === 0 &&
          body.total_pages === 0,
        { status: r.status, provisioned: body.provisioned, total: body.total },
        { status: 200, provisioned: false, total: 0 },
      );
    }

    // ── empty paginated payload echoes the requested pagination ─────────────
    r = await fetch(
      `${base}/api/marketing/dashboard/alerts?page=2&per_page=10`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    body = await r.json();
    assert(
      "GET /dashboard/alerts empty payload echoes page/per_page",
      body.page === 2 && body.per_page === 10,
      { page: body.page, per_page: body.per_page },
      { page: 2, per_page: 10 },
    );

    // ── mutations are NOT silently swallowed: still surface 503 ─────────────
    r = await fetch(`${base}/api/marketing/mystery-shopping/abc/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "approved" }),
    });
    assert(
      "PATCH /mystery-shopping/:id/status not provisioned → 503 (mutation, not masked)",
      r.status === 503,
      r.status,
      503,
    );
  } finally {
    await new Promise((res) => server.close(res));
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
