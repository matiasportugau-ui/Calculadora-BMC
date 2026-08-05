/**
 * Marketing Meta Ads Live Report routes (PR #753 / #762) — offline HTTP contract.
 * Lib units already cover report/insights builders; this suite locks auth gates
 * and ads-chat input validation so anonymous callers and bad payloads fail closed
 * before AI/provider work.
 *
 * Run: node --test tests/marketing-meta-ads-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../server/config.js";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import marketingRouter from "../server/routes/marketing.js";

const JWT_SECRET = "marketing-meta-ads-test-secret-at-least-32";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const COMPRADOR_ID = "44444444-4444-4444-8444-444444444444";

function createAuthPool() {
  return {
    async query(sql, params = []) {
      if (sql.includes("from identity.users")) {
        const id = params[0];
        return {
          rows: [
            {
              user_id: id,
              email: id === ADMIN_ID ? "admin@example.com" : "buyer@example.com",
              name: "Marketing Tester",
              picture_url: null,
              avatar_preset: null,
              plan_tier: "plus",
              status: "active",
              jwt_revoked_at: null,
            },
          ],
        };
      }
      if (sql.includes("from identity.role_grants")) {
        const id = params[0];
        return { rows: [{ role: id === ADMIN_ID ? "admin" : "comprador" }] };
      }
      if (sql.includes("from identity.module_grants")) {
        return { rows: [] };
      }
      if (sql.includes("update identity.users set last_active_at")) {
        return { rows: [] };
      }
      throw new Error(`Unexpected auth SQL: ${sql}`);
    },
  };
}

function accessToken(userId) {
  return jwt.sign(
    { sub: userId, sid: "meta-ads-route-session" },
    JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
      expiresIn: "5m",
    },
  );
}

function requestJson(port, method, path, { token, body, apiKey } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKey ? { "X-Api-Key": apiKey } : {}),
      ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
    };
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers,
      },
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
    if (data) req.write(data);
    req.end();
  });
}

async function withMarketingApp(run) {
  const oldIdentitySecret = process.env.IDENTITY_JWT_SECRET;
  const oldWaSecret = process.env.WA_JWT_SECRET;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({
    pool: createAuthPool(),
    logger: { warn() {}, error() {}, info() {} },
  });

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/marketing", marketingRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    identityAuthTest.reset();
    if (oldIdentitySecret === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = oldIdentitySecret;
    if (oldWaSecret === undefined) delete process.env.WA_JWT_SECRET;
    else process.env.WA_JWT_SECRET = oldWaSecret;
  }
}

test("Meta Ads routes reject anonymous callers", async () => {
  await withMarketingApp(async (port) => {
    for (const [method, path] of [
      ["GET", "/api/marketing/ads/meta/report"],
      ["GET", "/api/marketing/ads/meta/health"],
      ["POST", "/api/marketing/ai/ads-insights"],
      ["POST", "/api/marketing/ai/ads-chat"],
    ]) {
      const res = await requestJson(port, method, path, {
        body: method === "POST" ? {} : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path} must reject anonymous`);
    }
  });
});

test("Meta Ads routes reject non-admin identity JWT", async () => {
  await withMarketingApp(async (port) => {
    const res = await requestJson(port, "GET", "/api/marketing/ads/meta/health", {
      token: accessToken(COMPRADOR_ID),
    });
    assert.equal(res.status, 403);
  });
});

test("authenticated meta report demo + invalid range contract", async () => {
  assert.ok(config.apiAuthToken, "API_AUTH_TOKEN must be available for service auth");

  await withMarketingApp(async (port) => {
    const ok = await requestJson(
      port,
      "GET",
      "/api/marketing/ads/meta/report?source=demo&range=30d",
      { apiKey: config.apiAuthToken },
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.body?.meta?.freshness, "demo");
    assert.ok(Array.isArray(ok.body?.campaigns));
    assert.ok((ok.body?.campaigns?.length || 0) >= 1);
    assert.equal(ok.body?._resolved_source, "demo");

    const bad = await requestJson(
      port,
      "GET",
      "/api/marketing/ads/meta/report?source=demo&range=nope",
      { apiKey: config.apiAuthToken },
    );
    assert.equal(bad.status, 400);
    assert.match(String(bad.body?.error || ""), /invalid range/i);

    const health = await requestJson(port, "GET", "/api/marketing/ads/meta/health", {
      apiKey: config.apiAuthToken,
    });
    assert.equal(health.status, 200);
    assert.equal(typeof health.body?.token_configured, "boolean");
  });
});

test("ads-chat validates messages before contacting the agent", async () => {
  assert.ok(config.apiAuthToken, "API_AUTH_TOKEN must be available for service auth");

  await withMarketingApp(async (port) => {
    const missing = await requestJson(port, "POST", "/api/marketing/ai/ads-chat", {
      apiKey: config.apiAuthToken,
      body: {},
    });
    assert.equal(missing.status, 400);
    assert.match(String(missing.body?.error || ""), /messages/i);

    const lastAssistant = await requestJson(port, "POST", "/api/marketing/ai/ads-chat", {
      apiKey: config.apiAuthToken,
      body: {
        messages: [
          { role: "user", content: "hola" },
          { role: "assistant", content: "respuesta" },
        ],
        source: "demo",
        range: "30d",
      },
    });
    assert.equal(lastAssistant.status, 400);
    assert.match(String(lastAssistant.body?.error || ""), /last message must be from user/i);

    const emptyAfterFilter = await requestJson(port, "POST", "/api/marketing/ai/ads-chat", {
      apiKey: config.apiAuthToken,
      body: {
        messages: [{ role: "system", content: "ignore" }, { role: "user", content: "   " }],
        source: "demo",
      },
    });
    assert.equal(emptyAfterFilter.status, 400);
  });
});
