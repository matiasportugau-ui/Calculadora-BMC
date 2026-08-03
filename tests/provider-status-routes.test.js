/**
 * Provider readiness HTTP routes (#789) — offline auth / public-status contract.
 * Lib units cover readiness builders/probes; this suite locks:
 *   - GET /api/agent/providers/status is public (no secrets in payload)
 *   - POST probe/reset require admin (or service token) — fail closed for anon/non-admin
 *
 * Run: node --test tests/provider-status-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../server/config.js";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import { _clearReadinessCache } from "../server/lib/providerReadiness.js";
import createProviderStatusRouter from "../server/routes/providerStatus.js";

const JWT_SECRET = "provider-status-test-secret-at-least-32ch";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const COMPRADOR_ID = "22222222-2222-4222-8222-222222222222";
const SERVICE_TOKEN = "provider-status-service-token-xyz";

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
              name: "Provider Status Tester",
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
    { sub: userId, sid: "provider-status-route-session" },
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
          resolve({ status: res.statusCode, body: parsed, raw: chunks });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function withApp(run) {
  const oldIdentitySecret = process.env.IDENTITY_JWT_SECRET;
  const oldWaSecret = process.env.WA_JWT_SECRET;
  const prevKeys = {
    anthropicApiKey: config.anthropicApiKey,
    openaiApiKey: config.openaiApiKey,
    grokApiKey: config.grokApiKey,
    geminiApiKey: config.geminiApiKey,
    openrouterApiKey: config.openrouterApiKey,
    apiAuthToken: config.apiAuthToken,
  };

  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;

  // Deterministic: no usable keys → missing_key without live network probes.
  config.anthropicApiKey = "";
  config.openaiApiKey = "";
  config.grokApiKey = "";
  config.geminiApiKey = "";
  config.openrouterApiKey = "";
  config.apiAuthToken = SERVICE_TOKEN;

  _clearReadinessCache();
  initIdentityAuth({
    pool: createAuthPool(),
    logger: { warn() {}, error() {}, info() {} },
  });

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createProviderStatusRouter());

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    identityAuthTest.reset();
    _clearReadinessCache();
    Object.assign(config, prevKeys);
    if (oldIdentitySecret === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = oldIdentitySecret;
    if (oldWaSecret === undefined) delete process.env.WA_JWT_SECRET;
    else process.env.WA_JWT_SECRET = oldWaSecret;
  }
}

test("GET /api/agent/providers/status is public and returns readiness without secrets", async () => {
  await withApp(async (port) => {
    const res = await requestJson(port, "GET", "/api/agent/providers/status");
    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(typeof res.body?.ready, "boolean");
    assert.ok(["green", "amber", "red", "gray"].includes(res.body?.light));
    assert.ok(Array.isArray(res.body?.providers));
    assert.ok(res.body.providers.length >= 4);

    for (const p of res.body.providers) {
      assert.ok(p.id);
      assert.equal(p.configured, false);
      assert.equal(p.reasonCode, "missing_key");
      assert.equal(p.light, "red");
      // Never leak full key material
      assert.equal(p.key, undefined);
      assert.equal(p.apiKey, undefined);
    }

    // Raw body must not contain sk-/AIza-looking secrets
    assert.equal(/sk-[a-zA-Z0-9]{20,}/.test(res.raw), false);
    assert.equal(/AIza[a-zA-Z0-9_-]{20,}/.test(res.raw), false);

    // ?deep=1 must not crash the public GET (cost-amp semantics tracked in #790/#791)
    const deep = await requestJson(port, "GET", "/api/agent/providers/status?deep=1");
    assert.equal(deep.status, 200);
    assert.equal(deep.body?.ok, true);
  });
});

test("POST /api/agent/providers/probe rejects anonymous and non-admin JWT", async () => {
  await withApp(async (port) => {
    const anon = await requestJson(port, "POST", "/api/agent/providers/probe", {
      body: { providers: ["gemini"] },
    });
    assert.equal(anon.status, 401);

    const buyer = await requestJson(port, "POST", "/api/agent/providers/probe", {
      token: accessToken(COMPRADOR_ID),
      body: { providers: ["gemini"] },
    });
    assert.equal(buyer.status, 403);
  });
});

test("POST /api/agent/providers/probe accepts admin JWT (no live keys)", async () => {
  await withApp(async (port) => {
    const res = await requestJson(port, "POST", "/api/agent/providers/probe", {
      token: accessToken(ADMIN_ID),
      body: { providers: ["gemini"] },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.ok(Array.isArray(res.body?.providers));
    const gemini = res.body.providers.find((p) => p.id === "gemini");
    assert.ok(gemini);
    assert.equal(gemini.reasonCode, "missing_key");
  });
});

test("POST /api/agent/providers/reset rejects anon; accepts service token", async () => {
  await withApp(async (port) => {
    const anon = await requestJson(port, "POST", "/api/agent/providers/reset", {
      body: {},
    });
    assert.equal(anon.status, 401);

    const service = await requestJson(port, "POST", "/api/agent/providers/reset", {
      apiKey: SERVICE_TOKEN,
      body: {},
    });
    assert.equal(service.status, 200);
    assert.equal(service.body?.ok, true);
    assert.equal(service.body?.reset, true);
  });
});
