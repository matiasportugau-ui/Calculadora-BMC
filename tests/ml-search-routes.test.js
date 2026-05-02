// ═══════════════════════════════════════════════════════════════════════════
// /api/ml/search route smoke tests
// Run: node tests/ml-search-routes.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Sets API_AUTH_TOKEN before any dynamic import so config.js / requireAuth
// pick up the test token. The MercadoLibre client is fully stubbed — no
// network call is made — so this can run in any environment.

process.env.API_AUTH_TOKEN = "test-auth-token";
process.env.ML_CLIENT_SECRET = "test-secret"; // satisfies any cold reads
process.env.ML_SITE_ID = "MLU";

const TOKEN = process.env.API_AUTH_TOKEN;

const { default: express } = await import("express");
const { default: createMlSearchRouter } = await import(
  "../server/routes/mlSearch.js"
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

const fakeMlFactory = () => {
  const calls = [];
  return {
    calls,
    requestWithRetries: async ({ method, path, query }) => {
      calls.push({ method, path, query });
      return {
        site_id: "MLU",
        query: query?.q,
        paging: {
          total: 2,
          offset: query?.offset || 0,
          limit: query?.limit || 20,
        },
        results: [
          {
            id: "MLU111",
            title: "Isopanel EPS 50mm — Marca X",
            price: 1850,
            currency_id: "UYU",
            condition: "new",
            listing_type_id: "gold_pro",
            permalink: "https://articulo.mercadolibre.com.uy/MLU-111",
            thumbnail: "https://example.com/thumb1.jpg",
            seller: { id: 100, nickname: "VendedorA" },
            sold_quantity: 25,
            available_quantity: 8,
            accepts_mercadopago: true,
            shipping: { free_shipping: true },
            installments: { quantity: 6, amount: 308.33, currency_id: "UYU" },
          },
          {
            id: "MLU222",
            title: "Panel sandwich 100mm",
            price: 3400,
            currency_id: "UYU",
            condition: "used",
            seller: { id: 200, nickname: "VendedorB" },
            sold_quantity: null,
            available_quantity: 1,
          },
        ],
      };
    },
  };
};

const fakeConfig = {
  mlSiteId: "MLU",
  apiAuthToken: TOKEN,
};
const fakeLogger = { info: () => {} };

async function run() {
  console.log("\n═══ ML SEARCH SUITE: /api/ml/search ═══");

  const fakeMl = fakeMlFactory();
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    createMlSearchRouter({ ml: fakeMl, config: fakeConfig, logger: fakeLogger }),
  );

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    // ── 401 sin auth ─────────────────────────────────────────────────────────
    let r = await fetch(`${base}/api/ml/search?q=isopanel`);
    assert(
      "GET /api/ml/search without auth → 401",
      r.status === 401,
      r.status,
      401,
    );

    // ── 400 sin q ────────────────────────────────────────────────────────────
    r = await fetch(`${base}/api/ml/search`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    let body = await r.json().catch(() => ({}));
    assert(
      "GET /api/ml/search without q → 400",
      r.status === 400 && body.ok === false,
      { status: r.status, ok: body.ok },
      { status: 400, ok: false },
    );

    // ── 200 happy path con Bearer ────────────────────────────────────────────
    r = await fetch(`${base}/api/ml/search?q=isopanel&limit=2`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    body = await r.json();
    assert(
      "GET /api/ml/search → 200 ok with slim results",
      r.status === 200 &&
        body.ok === true &&
        body.site_id === "MLU" &&
        body.query === "isopanel" &&
        Array.isArray(body.results) &&
        body.results.length === 2,
      {
        status: r.status,
        ok: body.ok,
        site: body.site_id,
        len: body.results?.length,
      },
      { status: 200, ok: true, site: "MLU", len: 2 },
    );
    assert(
      "results[0] has slim shape (id/title/price/seller_id/permalink)",
      body.results[0]?.id === "MLU111" &&
        typeof body.results[0]?.price === "number" &&
        body.results[0]?.seller_id === 100 &&
        typeof body.results[0]?.permalink === "string" &&
        body.results[0]?.shipping_free === true,
      body.results[0],
      "first item slim",
    );
    assert(
      "X-Cache header is MISS on first call",
      r.headers.get("x-cache") === "MISS",
      r.headers.get("x-cache"),
      "MISS",
    );

    // ── Cache HIT en la segunda llamada idéntica ─────────────────────────────
    r = await fetch(`${base}/api/ml/search?q=isopanel&limit=2`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert(
      "second identical request returns X-Cache HIT",
      r.headers.get("x-cache") === "HIT",
      r.headers.get("x-cache"),
      "HIT",
    );

    // ── nocache=1 fuerza re-fetch ────────────────────────────────────────────
    r = await fetch(`${base}/api/ml/search?q=isopanel&limit=2&nocache=1`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert(
      "nocache=1 returns X-Cache MISS",
      r.headers.get("x-cache") === "MISS",
      r.headers.get("x-cache"),
      "MISS",
    );

    // ── x-api-key fallback funciona ──────────────────────────────────────────
    r = await fetch(`${base}/api/ml/search?q=otraconsulta`, {
      headers: { "x-api-key": TOKEN },
    });
    assert(
      "GET /api/ml/search with x-api-key → 200",
      r.status === 200,
      r.status,
      200,
    );

    // ── límite máximo respetado (51 → cap a 50) ──────────────────────────────
    r = await fetch(`${base}/api/ml/search?q=cap&limit=999`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    body = await r.json();
    const lastCall = fakeMl.calls[fakeMl.calls.length - 1];
    assert(
      "limit > MAX is capped at 50",
      r.status === 200 && body.ok === true && lastCall?.query?.limit === 50,
      { status: r.status, ok: body.ok, limitSent: lastCall?.query?.limit },
      { status: 200, ok: true, limitSent: 50 },
    );

    // ── offset negativo → 0 ──────────────────────────────────────────────────
    r = await fetch(`${base}/api/ml/search?q=offsetneg&offset=-5`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const lastCall2 = fakeMl.calls[fakeMl.calls.length - 1];
    assert(
      "negative offset is clamped to 0",
      r.status === 200 && lastCall2?.query?.offset === 0,
      { status: r.status, offsetSent: lastCall2?.query?.offset },
      { status: 200, offsetSent: 0 },
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
