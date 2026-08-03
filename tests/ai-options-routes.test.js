/**
 * GET /api/agent/ai-options (#789) — public readiness envelope contract.
 * Lib units cover key presence / OpenRouter; this suite locks:
 *   - response shape (ok, providers, autoOrder)
 *   - no secret material in the JSON body
 *   - endpoint stays public and non-crashing (incl. ?deep=1 query)
 *
 * Note: public ?deep=1 force-probe cost amp is tracked in open security PRs
 * (#790/#791). This suite intentionally does not assert forceProbe wiring.
 * Keys are cleared so readiness never hits the network.
 *
 * Run: node --test tests/ai-options-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { config } from "../server/config.js";
import { _clearReadinessCache } from "../server/lib/providerReadiness.js";

process.env.API_AUTH_TOKEN =
  process.env.API_AUTH_TOKEN || "ai-options-route-test-token";

const { default: agentChatRouter } = await import("../server/routes/agentChat.js");

function requestJson(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method: "GET", path },
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
          resolve({ status: res.statusCode, body: parsed, raw: chunks });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function withApp(run) {
  const prevKeys = {
    anthropicApiKey: config.anthropicApiKey,
    openaiApiKey: config.openaiApiKey,
    grokApiKey: config.grokApiKey,
    geminiApiKey: config.geminiApiKey,
    openRouterApiKey: config.openRouterApiKey,
  };
  config.anthropicApiKey = "";
  config.openaiApiKey = "";
  config.grokApiKey = "";
  config.geminiApiKey = "";
  config.openRouterApiKey = "";
  _clearReadinessCache();

  const app = express();
  app.use("/api", agentChatRouter);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    _clearReadinessCache();
    Object.assign(config, prevKeys);
  }
}

test("GET /api/agent/ai-options is public and returns envelope without secrets", async () => {
  await withApp(async (port) => {
    const res = await requestJson(port, "/api/agent/ai-options");
    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.ok(Array.isArray(res.body?.providers));
    assert.ok(Array.isArray(res.body?.autoOrder));
    // No keys configured → empty picker lists (fail closed for selection)
    assert.equal(res.body.providers.length, 0);
    assert.equal(res.body.autoOrder.length, 0);

    // Readiness envelope from #789 (cache-first; may be present even with empty providers)
    if (res.body.readiness) {
      assert.equal(typeof res.body.readiness.ready, "boolean");
      assert.ok(["green", "amber", "red", "gray"].includes(res.body.readiness.light));
    }

    assert.equal(res.body.apiKey, undefined);
    assert.equal(res.body.anthropicApiKey, undefined);
    assert.equal(/sk-[a-zA-Z0-9]{20,}/.test(res.raw), false);
    assert.equal(/AIza[a-zA-Z0-9_-]{20,}/.test(res.raw), false);
  });
});

test("GET /api/agent/ai-options?deep=1 still returns ok (no crash)", async () => {
  await withApp(async (port) => {
    const res = await requestJson(port, "/api/agent/ai-options?deep=1");
    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.ok(Array.isArray(res.body?.providers));
  });
});
