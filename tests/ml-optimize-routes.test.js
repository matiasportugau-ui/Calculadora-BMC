// ═══════════════════════════════════════════════════════════════════════════
// /api/ml/optimize/listing + /api/ml/playbooks regression tests
// Run: node tests/ml-optimize-routes.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Environment is set before dynamic imports so auth/config are deterministic.
// MercadoLibre is fully stubbed; no external service or AI provider is called.

process.env.API_AUTH_TOKEN = "test-auth-token";
process.env.ASSISTANTS_ACTIVE = "ml";

const TOKEN = process.env.API_AUTH_TOKEN;
const { default: assert } = await import("node:assert/strict");
const { default: express } = await import("express");
const { config } = await import("../server/config.js");
const { default: createMlOptimizeRouter } = await import(
  "../server/routes/mlOptimize.js"
);

const logger = { warn: () => {} };

async function withServer({ ml, apiConfig }, callback) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(createMlOptimizeRouter({ ml, config: apiConfig, logger }));

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const noKeysConfig = {
  anthropicApiKey: "",
  openaiApiKey: "",
  grokApiKey: "",
  geminiApiKey: "",
};

const originalAssistantsActive = config.assistantsActive;

try {
  const mlCalls = [];
  await withServer({
    apiConfig: noKeysConfig,
    ml: {
      requestWithRetries: async (request) => {
        mlCalls.push(request);
        throw new Error("ML must not be called without configured AI");
      },
    },
  }, async (base) => {
    let response = await fetch(`${base}/api/ml/optimize/listing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "MLU123" }),
    });
    assert.equal(response.status, 401, "listing audit must reject anonymous callers");

    response = await fetch(`${base}/api/ml/playbooks`);
    assert.equal(response.status, 401, "playbooks must reject anonymous callers");

    response = await fetch(`${base}/api/ml/optimize/listing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemId: "   " }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "Missing itemId" });

    config.assistantsActive = [];
    response = await fetch(`${base}/api/ml/optimize/listing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemId: "MLU123" }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false,
      reason: "assistant_disabled",
      assistant: "ml",
      hint: "Habilitá este asistente agregando su key a ASSISTANTS_ACTIVE.",
    });

    response = await fetch(`${base}/api/ml/playbooks`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const playbooks = await response.json();
    assert.equal(response.status, 200, "read-only playbooks stay available when AI is disabled");
    assert.equal(playbooks.ok, true);
    assert.ok(Array.isArray(playbooks.items));
    assert.ok(Array.isArray(playbooks.sources));
    assert.equal(typeof playbooks.generated_at, "string");

    config.assistantsActive = ["ml"];
    response = await fetch(`${base}/api/ml/optimize/listing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemId: "MLU123" }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "IA_NOT_CONFIGURED");
    assert.equal(mlCalls.length, 0, "missing AI config must fail before MercadoLibre");
  });

  await withServer({
    apiConfig: { ...noKeysConfig, anthropicApiKey: "test-provider-key" },
    ml: {
      requestWithRetries: async () => {
        const error = new Error("listing not found");
        error.status = 404;
        throw error;
      },
    },
  }, async (base) => {
    config.assistantsActive = ["ml"];
    const response = await fetch(`${base}/api/ml/optimize/listing`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ itemId: "MLU404" }),
    });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error, "Failed to load listing from MercadoLibre");
    assert.equal(body.detail, "listing not found");
  });
} finally {
  config.assistantsActive = originalAssistantsActive;
}

console.log("ml optimize route tests passed");
