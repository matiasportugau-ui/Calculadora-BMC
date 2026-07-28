/**
 * GET /api/agent/obs-summary (#783) — auth + payload contract.
 * Lib units cover the memory ring; this suite locks:
 *   - requireDevModeAuthMiddleware (no anonymous cost/latency dump)
 *   - response shape: cost/latency/flags/prompts (no secrets)
 *   - windowMinutes clamping
 *   - tools-manifest ?tier= HTTP wiring (IMP-14)
 *
 * Run: node --test tests/agent-obs-summary-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { config } from "../server/config.js";
import {
  recordObsSample,
  __obsRingTest,
} from "../server/lib/agentObsRing.js";

process.env.API_AUTH_TOKEN =
  process.env.API_AUTH_TOKEN || "obs-summary-route-test-token";

const { default: agentChatRouter } = await import("../server/routes/agentChat.js");
const TOKEN = process.env.API_AUTH_TOKEN;
const ringCtl = __obsRingTest();

function requestJson(port, path, { token, apiKey } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { "X-Api-Key": apiKey } : {}),
    };
    const req = http.request(
      { host: "127.0.0.1", port, method: "GET", path, headers },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          if (chunks) {
            try {
              parsed = JSON.parse(chunks);
            } catch {
              parsed = { raw: chunks };
            }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function withAgentApp(run) {
  const prev = {
    relax: config.panelinRelaxDevAuth,
    token: config.apiAuthToken,
    rag: config.ragEnabled,
    hybrid: config.ragHybrid,
  };
  config.panelinRelaxDevAuth = false;
  config.apiAuthToken = TOKEN;
  config.ragEnabled = true;
  config.ragHybrid = true;

  ringCtl.reset();
  recordObsSample({
    kind: "cost",
    provider: "gemini",
    estimated_cost_usd: 0.0123,
    latency_ms: 120,
  });
  recordObsSample({
    kind: "turn",
    provider: "grok",
    latency_ms: 400,
    ttft_ms: 80,
  });

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", agentChatRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    ringCtl.reset();
    config.panelinRelaxDevAuth = prev.relax;
    config.apiAuthToken = prev.token;
    config.ragEnabled = prev.rag;
    config.ragHybrid = prev.hybrid;
  }
}

test("GET /api/agent/obs-summary rejects anonymous and wrong token", async () => {
  await withAgentApp(async (port) => {
    const anon = await requestJson(port, "/api/agent/obs-summary");
    assert.equal(anon.status, 401);
    assert.equal(anon.body?.ok, false);

    const wrong = await requestJson(port, "/api/agent/obs-summary", {
      token: "not-the-token",
    });
    assert.equal(wrong.status, 401);
  });
});

test("GET /api/agent/obs-summary returns hub cost/latency + RAG flags with auth", async () => {
  await withAgentApp(async (port) => {
    const res = await requestJson(port, "/api/agent/obs-summary?windowMinutes=60", {
      token: TOKEN,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.source, "memory_ring");
    assert.equal(res.body?.window_ms, 60 * 60 * 1000);
    assert.ok(res.body?.sample_count >= 2);
    assert.ok(res.body?.cost?.sum_usd >= 0.012);
    assert.ok(res.body?.latency?.p50_ms != null);
    assert.equal(res.body?.flags?.rag_enabled, true);
    assert.equal(res.body?.flags?.rag_hybrid, true);
    assert.ok(res.body?.prompts?.prompts_sha);
    const blob = JSON.stringify(res.body);
    assert.equal(blob.includes(TOKEN), false, "must not echo API_AUTH_TOKEN");
    assert.equal(/sk-|xai-|AIza/i.test(blob), false, "must not leak API key shapes");
  });
});

test("GET /api/agent/obs-summary accepts X-Api-Key and clamps windowMinutes", async () => {
  await withAgentApp(async (port) => {
    const huge = await requestJson(port, "/api/agent/obs-summary?windowMinutes=999999", {
      apiKey: TOKEN,
    });
    assert.equal(huge.status, 200);
    assert.equal(huge.body?.window_ms, 7 * 24 * 60 * 60 * 1000);

    const tiny = await requestJson(port, "/api/agent/obs-summary?windowMinutes=0", {
      apiKey: TOKEN,
    });
    assert.equal(tiny.status, 200);
    // Query string "0" is truthy, so Number("0")→0 then Math.max(1, …) clamps to 1 minute.
    assert.equal(tiny.body?.window_ms, 60 * 1000);
  });
});

test("GET /api/agent/tools-manifest?tier= filters tools over HTTP", async () => {
  await withAgentApp(async (port) => {
    const all = await requestJson(port, "/api/agent/tools-manifest");
    assert.equal(all.status, 200);
    assert.ok(all.body?.count >= 28);
    assert.ok(Array.isArray(all.body?.tiers));

    const quote = await requestJson(port, "/api/agent/tools-manifest?tier=quote");
    assert.equal(quote.status, 200);
    assert.equal(quote.body?.tier_filter, "quote");
    assert.ok(quote.body?.count > 0);
    assert.ok(quote.body.count < all.body.count);
    assert.ok(quote.body.tools.every((t) => t.tier === "quote"));
  });
});
