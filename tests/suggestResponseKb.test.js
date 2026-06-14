// ═══════════════════════════════════════════════════════════════════════════
// /api/crm/suggest-response — KB delegation contract tests
// Run: node tests/suggestResponseKb.test.js
//
// Verifies the route validation + the new SUGGEST_RESPONSE_USE_AGENT_CORE flag
// gates without making real provider calls. Real KB-retrieval coverage requires
// SDK mocking infra and is deferred.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";

// Keep this contract suite offline/deterministic even when local .env has live AI keys.
for (const key of [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GROK_API_KEY",
  "GEMINI_API_KEY",
  "AI_GATEWAY_API_KEY",
]) {
  process.env[key] = "";
}

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name}`);
  console.log(`     got:      ${JSON.stringify(actual)}`);
  console.log(`     expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

async function startServer(routerConfig) {
  const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createBmcDashboardRouter(routerConfig));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function postJson(baseUrl, path, body) {
  const resp = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await resp.json(); } catch { /* non-JSON */ }
  return { status: resp.status, json };
}

const EMPTY_KEYS_CONFIG = {
  bmcSheetId: "",
  bmcSheetSchema: "Master_Cotizaciones",
  anthropicApiKey: "",
  openaiApiKey: "",
  grokApiKey: "",
  geminiApiKey: "",
};

const FAKE_KEYS_CONFIG = {
  ...EMPTY_KEYS_CONFIG,
  anthropicApiKey: "sk-ant-fake-test-key-not-real",
};

async function run() {
  console.log("\n═══ /api/crm/suggest-response — KB delegation contract ═══\n");

  // ── Case 1: missing consulta → 400 ─────────────────────────────────────
  {
    const { server, baseUrl } = await startServer(EMPTY_KEYS_CONFIG);
    try {
      const { status, json } = await postJson(baseUrl, "/api/crm/suggest-response", {
        origen: "MLU123",
        cliente: "Test",
      });
      assert(
        "missing consulta returns 400",
        status === 400 && json?.ok === false && /consulta/i.test(json?.error || ""),
        { status, json },
        { status: 400, ok: false },
      );
    } finally {
      server.close();
    }
  }

  // ── Case 2: no API keys configured → 503 IA_NOT_CONFIGURED ─────────────
  {
    const { server, baseUrl } = await startServer(EMPTY_KEYS_CONFIG);
    try {
      const { status, json } = await postJson(baseUrl, "/api/crm/suggest-response", {
        consulta: "Plazo entrega ISODEC EPS 100mm?",
        origen: "MLU123",
        cliente: "Test",
      });
      assert(
        "no API keys returns 503 IA_NOT_CONFIGURED",
        status === 503 && json?.code === "IA_NOT_CONFIGURED",
        { status, code: json?.code },
        { status: 503, code: "IA_NOT_CONFIGURED" },
      );
    } finally {
      server.close();
    }
  }

  // ── Case 3: agentCore path + unsupported provider → 503 with details ──
  // Verifies the lib delegation path catches and surfaces err.errors as details
  // without making a live provider SDK call.
  {
    const original = process.env.SUGGEST_RESPONSE_USE_AGENT_CORE;
    process.env.SUGGEST_RESPONSE_USE_AGENT_CORE = "true";
    try {
      // Re-import bmcDashboard to pick up the new env (top-level constant).
      // Using import cache reset via dynamic import + cache busting query-style is
      // not native ESM; instead, we trust the constant captured at module load.
      // For this test we invoke a fresh module instance through path resolution.
      const fresh = `../server/routes/bmcDashboard.js?t=${Date.now()}`;
      const mod = await import(fresh);
      const app = express();
      app.use(express.json({ limit: "1mb" }));
      app.use("/api", mod.default(FAKE_KEYS_CONFIG));
      const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;
      try {
        const { status, json } = await postJson(baseUrl, "/api/crm/suggest-response", {
          consulta: "Plazo entrega?",
          origen: "MLU123",
          cliente: "TestCli",
          provider: "__test_missing_provider__",
        });
        assert(
          "agentCore path with unsupported provider → 503 + details array",
          status === 503 &&
            json?.ok === false &&
            Array.isArray(json?.details) &&
            json.details.length > 0,
          { status, hasDetails: Array.isArray(json?.details) },
          { status: 503, hasDetails: true },
        );
      } finally {
        server.close();
      }
    } finally {
      if (original === undefined) delete process.env.SUGGEST_RESPONSE_USE_AGENT_CORE;
      else process.env.SUGGEST_RESPONSE_USE_AGENT_CORE = original;
    }
  }

  // ── Case 4: legacy path (flag=false) preserves response contract ───────
  // When flag=false, response shape on failure should be { ok:false, error, details }
  // (no `model` field on success; details is array on failure).
  {
    const original = process.env.SUGGEST_RESPONSE_USE_AGENT_CORE;
    process.env.SUGGEST_RESPONSE_USE_AGENT_CORE = "false";
    try {
      const fresh = `../server/routes/bmcDashboard.js?t=${Date.now()}-2`;
      const mod = await import(fresh);
      const app = express();
      app.use(express.json({ limit: "1mb" }));
      app.use("/api", mod.default(FAKE_KEYS_CONFIG));
      const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;
      try {
        const { status, json } = await postJson(baseUrl, "/api/crm/suggest-response", {
          consulta: "Plazo?",
          origen: "MLU123",
          cliente: "TestCli",
          provider: "__test_missing_provider__",
        });
        assert(
          "legacy path (flag=false) → 503 + details array, no model field",
          status === 503 &&
            json?.ok === false &&
            Array.isArray(json?.details) &&
            !("model" in json),
          { status, hasDetails: Array.isArray(json?.details), hasModel: "model" in (json || {}) },
          { status: 503, hasDetails: true, hasModel: false },
        );
      } finally {
        server.close();
      }
    } finally {
      if (original === undefined) delete process.env.SUGGEST_RESPONSE_USE_AGENT_CORE;
      else process.env.SUGGEST_RESPONSE_USE_AGENT_CORE = original;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
