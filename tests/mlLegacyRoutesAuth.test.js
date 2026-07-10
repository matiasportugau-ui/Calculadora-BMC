// Security regression guard: legacy /ml/* reads must not be public.
// Run: node tests/mlLegacyRoutesAuth.test.js

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";
process.env.ML_SITE_ID = "MLU";

const identityAuth = await import("../server/lib/identityAuth.js");
const { config } = await import("../server/config.js");
const { createMlLegacyRouter } = await import("../server/routes/mlLegacy.js");

config.apiAuthToken = process.env.API_AUTH_TOKEN;
config.mlSiteId = "MLU";

function makeIdentityPool() {
  const user = {
    user_id: "u-operator",
    email: "operator@bmc.test",
    name: "Operator",
    picture_url: null,
    avatar_preset: null,
    plan_tier: "plus",
    status: "active",
    jwt_revoked_at: null,
  };

  return {
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (
        norm.startsWith(
          "select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at",
        )
      ) {
        return { rows: params[0] === user.user_id ? [user] : [] };
      }
      if (norm.startsWith("select role from identity.role_grants")) {
        return { rows: [{ user_id: user.user_id, role: "operator" }] };
      }
      if (norm.startsWith("select module, level from identity.module_grants")) {
        return { rows: [] };
      }
      if (norm.startsWith("update identity.users set last_active_at = now()")) {
        return { rows: [] };
      }
      throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
    },
  };
}

function bearerFor(userId = "u-operator") {
  const token = jwt.sign(
    { sub: userId, sid: "sess-test", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: 60 * 15,
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
    },
  );
  return `Bearer ${token}`;
}

let server;
let port;
let calls;

function makeMlClient() {
  return {
    async resolveSellerId() {
      return "SELLER123";
    },
    async requestWithRetries(args) {
      calls.push(args);
      return { ok: true, method: args.method, path: args.path, query: args.query ?? null };
    },
  };
}

before(async () => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/ml", createMlLegacyRouter({ ml: makeMlClient(), config }));

  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  calls = [];
  identityAuth.__test__.reset();
  identityAuth.initIdentityAuth({
    pool: makeIdentityPool(),
    logger: { warn() {}, error() {}, info() {} },
  });
});

const url = (path) => `http://127.0.0.1:${port}${path}`;
const serviceBearer = { Authorization: "Bearer static_service_token_xyz" };

describe("legacy /ml/* auth boundary", () => {
  it("rejects anonymous sensitive reads before any MercadoLibre client call", async () => {
    for (const path of [
      "/ml/users/me",
      "/ml/users/123",
      "/ml/listings",
      "/ml/items/MLU1",
      "/ml/questions",
      "/ml/questions/987",
      "/ml/orders",
      "/ml/orders/456",
    ]) {
      const res = await fetch(url(path));
      assert.equal(res.status, 401, `${path} should require auth`);
    }

    assert.deepEqual(calls, []);
  });

  it("accepts the static service token on read routes and preserves ML forwarding", async () => {
    let res = await fetch(url("/ml/users/me"), { headers: serviceBearer });
    assert.equal(res.status, 200);
    assert.equal(calls.at(-1).path, "/users/me");

    res = await fetch(url("/ml/listings?status=closed&limit=2&offset=7"), {
      headers: serviceBearer,
    });
    assert.equal(res.status, 200);
    assert.equal(calls.at(-1).path, "/users/SELLER123/items/search?status=closed&limit=2&offset=7");

    res = await fetch(url("/ml/questions?limit=3&status=UNANSWERED&junk=drop"), {
      headers: serviceBearer,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(calls.at(-1), {
      method: "GET",
      path: "/questions/search",
      query: {
        limit: "3",
        status: "UNANSWERED",
        seller_id: "SELLER123",
        api_version: "4",
        site_id: "MLU",
      },
    });

    res = await fetch(url("/ml/orders?limit=4&sort=date_desc&ignored=x"), {
      headers: serviceBearer,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(calls.at(-1), {
      method: "GET",
      path: "/orders/search",
      query: {
        limit: "4",
        sort: "date_desc",
        seller: "SELLER123",
      },
    });
  });

  it("accepts x-api-key and active operator JWTs used by internal ML callers", async () => {
    let res = await fetch(url("/ml/questions/987"), {
      headers: { "x-api-key": "static_service_token_xyz" },
    });
    assert.equal(res.status, 200);
    assert.equal(calls.at(-1).path, "/questions/987");

    res = await fetch(url("/ml/orders/456"), {
      headers: { Authorization: bearerFor() },
    });
    assert.equal(res.status, 200);
    assert.equal(calls.at(-1).path, "/orders/456");
  });
});
