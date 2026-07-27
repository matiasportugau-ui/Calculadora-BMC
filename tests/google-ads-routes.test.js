/**
 * Google Ads HTTP routes (#722) — offline auth / validation / dry-run contract.
 * Lib dry-run units live in googleAdsClient.test.js; this suite locks:
 *   - anonymous + non-admin fail closed
 *   - mutation body validation (budget/name) before API work
 *   - pause defaults to dry-run via injected client (no network)
 *
 * Run: node --test tests/google-ads-routes.test.js
 */

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../server/config.js";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";
import { createAdsRouter } from "../server/routes/ads.js";

const JWT_SECRET = "google-ads-routes-test-secret-at-least-32";
const ADMIN_ID = "55555555-5555-4555-8555-555555555555";
const COMPRADOR_ID = "66666666-6666-4666-8666-666666666666";

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
              name: "Ads Tester",
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
    { sub: userId, sid: "google-ads-route-session" },
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

function makeFakeGoogleAds({ pauseCalls }) {
  return {
    async listAccessibleCustomers() {
      return ["customers/8607757427"];
    },
    async searchStream() {
      return [];
    },
    async pauseCampaign(customerId, campaignId, { apply } = {}) {
      pauseCalls.push({ customerId, campaignId, apply: apply === true });
      return {
        dryRun: apply !== true,
        applied: apply === true,
        customerId,
        operations: [{ entity: "campaign", operation: "update" }],
      };
    },
    async enableCampaign() {
      return { dryRun: true, applied: false };
    },
    async updateBudget() {
      return { dryRun: true, applied: false };
    },
    async updateCampaignName() {
      return { dryRun: true, applied: false };
    },
  };
}

async function withAdsApp(run, { googleAds } = {}) {
  const oldIdentitySecret = process.env.IDENTITY_JWT_SECRET;
  const oldWaSecret = process.env.WA_JWT_SECRET;
  const oldMcc = config.googleAdsLoginCustomerId;
  process.env.IDENTITY_JWT_SECRET = JWT_SECRET;
  delete process.env.WA_JWT_SECRET;
  initIdentityAuth({
    pool: createAuthPool(),
    logger: { warn() {}, error() {}, info() {} },
  });

  const pauseCalls = [];
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/api/ads",
    createAdsRouter({
      googleAds: googleAds ?? makeFakeGoogleAds({ pauseCalls }),
      pool: null,
    }),
  );

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await run(server.address().port, { pauseCalls });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    identityAuthTest.reset();
    config.googleAdsLoginCustomerId = oldMcc;
    if (oldIdentitySecret === undefined) delete process.env.IDENTITY_JWT_SECRET;
    else process.env.IDENTITY_JWT_SECRET = oldIdentitySecret;
    if (oldWaSecret === undefined) delete process.env.WA_JWT_SECRET;
    else process.env.WA_JWT_SECRET = oldWaSecret;
  }
}

test("Google Ads routes reject anonymous callers", async () => {
  await withAdsApp(async (port) => {
    for (const [method, path] of [
      ["GET", "/api/ads/accounts"],
      ["GET", "/api/ads/mcc/linked-accounts"],
      ["POST", "/api/ads/accounts/1/campaigns/2/pause"],
      ["POST", "/api/ads/accounts/1/campaigns/2/budget"],
    ]) {
      const res = await requestJson(port, method, path, {
        body: method === "POST" ? {} : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path} must reject anonymous`);
    }
  });
});

test("Google Ads routes reject non-admin identity JWT", async () => {
  await withAdsApp(async (port) => {
    const res = await requestJson(port, "GET", "/api/ads/accounts", {
      token: accessToken(COMPRADOR_ID),
    });
    assert.equal(res.status, 403);
  });
});

test("admin pause defaults to dry-run (apply omitted)", async () => {
  await withAdsApp(async (port, { pauseCalls }) => {
    const res = await requestJson(port, "POST", "/api/ads/accounts/8607757427/campaigns/99/pause", {
      token: accessToken(ADMIN_ID),
      body: {},
    });
    assert.equal(res.status, 200);
    assert.equal(res.body?.dryRun, true);
    assert.equal(res.body?.applied, false);
    assert.equal(pauseCalls.length, 1);
    assert.equal(pauseCalls[0].apply, false);
  });
});

test("mutation validation rejects bad budget and empty name", async () => {
  await withAdsApp(async (port) => {
    const badBudget = await requestJson(
      port,
      "POST",
      "/api/ads/accounts/8607757427/campaigns/99/budget",
      { token: accessToken(ADMIN_ID), body: { amount_micros: 0 } },
    );
    assert.equal(badBudget.status, 400);
    assert.match(String(badBudget.body?.message || ""), /amount_micros/);

    const badName = await requestJson(
      port,
      "POST",
      "/api/ads/accounts/8607757427/campaigns/99/name",
      { token: accessToken(ADMIN_ID), body: { name: "   " } },
    );
    assert.equal(badName.status, 400);
    assert.match(String(badName.body?.message || ""), /name is required/);
  });
});

test("mcc linked-accounts fails closed when MCC id missing", async () => {
  await withAdsApp(async (port) => {
    config.googleAdsLoginCustomerId = "";
    const res = await requestJson(port, "GET", "/api/ads/mcc/linked-accounts", {
      token: accessToken(ADMIN_ID),
    });
    assert.equal(res.status, 500);
    assert.match(String(res.body?.error || ""), /GOOGLE_ADS_LOGIN_CUSTOMER_ID/);
  });
});

test("service token can list accounts via injected client", async () => {
  assert.ok(config.apiAuthToken, "API_AUTH_TOKEN must be available for service auth");
  await withAdsApp(async (port) => {
    const res = await requestJson(port, "GET", "/api/ads/accounts", {
      apiKey: config.apiAuthToken,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body?.resource_names, ["customers/8607757427"]);
  });
});
