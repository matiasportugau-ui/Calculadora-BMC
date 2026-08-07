// TraKtiMe ActivityWatch authz — comprador must not read host-scoped OS activity.
// Bug BG: /api/activity/* used bare requireUser(); any Google JWT could call
// today/buckets when TRAKTIME_AW_ENABLED=1 (incl. via traktime_activity_today).
//
// Run: node --test tests/traktime-activity-authz.test.js

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import * as identityAuth from "../server/lib/identityAuth.js";
import createActivityRouter from "../server/routes/activity.js";
import { config } from "../server/config.js";

process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
if (process.env.WA_JWT_SECRET === process.env.IDENTITY_JWT_SECRET) {
  process.env.WA_JWT_SECRET = "wa_test_secret_different_from_identity_aw_xx";
}

const USERS = {
  "u-comprador": {
    user_id: "u-comprador",
    email: "comprador@example.com",
    name: "Comprador",
    picture_url: null,
    avatar_preset: null,
    plan_tier: "free",
    status: "active",
    jwt_revoked_at: null,
  },
  "u-operator": {
    user_id: "u-operator",
    email: "operator@example.com",
    name: "Operator",
    picture_url: null,
    avatar_preset: null,
    plan_tier: "plus",
    status: "active",
    jwt_revoked_at: null,
  },
};

const ROLES = {
  "u-comprador": "comprador",
  "u-operator": "operator",
};

function makePoolShim() {
  return {
    async query(sql, params = []) {
      const q = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (
        q.startsWith(
          "select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at",
        )
      ) {
        const u = USERS[params[0]];
        return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
      }
      if (q.startsWith("select role from identity.role_grants")) {
        const role = ROLES[params[0]] || "comprador";
        return { rows: [{ role }], rowCount: 1 };
      }
      if (q.startsWith("select module, level from identity.module_grants")) {
        return { rows: [], rowCount: 0 };
      }
      if (q.startsWith("update identity.users set last_active_at")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unhandled query: ${q}`);
    },
  };
}

function bearerFor(userId) {
  return jwt.sign(
    { sub: userId, sid: `sess-${userId}` },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
      expiresIn: "15m",
    },
  );
}

function requestJson(port, method, path, { token } = {}) {
  return new Promise((resolve, reject) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const req = http.request(
      { host: "127.0.0.1", port, method, path, headers },
      (res) => {
        let chunks = "";
        res.on("data", (d) => {
          chunks += d;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = chunks ? JSON.parse(chunks) : null;
          } catch {
            parsed = { raw: chunks };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("ActivityWatch operator gate (Bug BG)", () => {
  let server;
  let port;
  let awServer;
  let saved;

  beforeEach(async () => {
    saved = {
      awEnabled: config.traktimeAwEnabled,
      awBaseUrl: config.traktimeAwBaseUrl,
    };
    identityAuth.__test__.reset();
    identityAuth.initIdentityAuth({
      pool: makePoolShim(),
      logger: { warn() {}, error() {}, info() {} },
    });

    const aw = express();
    aw.get("/api/0/buckets/", (_req, res) =>
      res.json({ "aw-watcher-window_host": { id: "aw-watcher-window_host", type: "currentwindow" } }),
    );
    aw.get("/api/0/buckets/:id/events", (_req, res) =>
      res.json([{ duration: 60, data: { app: "Code", title: "secret.js" } }]),
    );
    awServer = await new Promise((r) => {
      const s = aw.listen(0, "127.0.0.1", () => r(s));
    });
    config.traktimeAwEnabled = true;
    config.traktimeAwBaseUrl = `http://127.0.0.1:${awServer.address().port}`;

    const app = express();
    app.use(createActivityRouter(config, { warn() {}, error() {} }));
    server = await new Promise((r) => {
      const s = http.createServer(app).listen(0, "127.0.0.1", () => r(s));
    });
    port = server.address().port;
  });

  afterEach(async () => {
    if (server) await new Promise((r) => server.close(r));
    if (awServer) await new Promise((r) => awServer.close(r));
    identityAuth.__test__.reset();
    config.traktimeAwEnabled = saved.awEnabled;
    config.traktimeAwBaseUrl = saved.awBaseUrl;
  });

  it("unauthenticated → 401", async () => {
    const r = await requestJson(port, "GET", "/api/activity/today");
    assert.equal(r.status, 401);
  });

  it("comprador JWT → 403 without hitting aw-server data", async () => {
    const r = await requestJson(port, "GET", "/api/activity/today", {
      token: bearerFor("u-comprador"),
    });
    assert.equal(r.status, 403);
    assert.ok(
      r.body?.error === "insufficient_role" || r.body?.error === "forbidden",
      JSON.stringify(r.body),
    );
  });

  it("comprador JWT → status also 403", async () => {
    const r = await requestJson(port, "GET", "/api/activity/status", {
      token: bearerFor("u-comprador"),
    });
    assert.equal(r.status, 403);
  });

  it("operator JWT → 200 today summary", async () => {
    const r = await requestJson(port, "GET", "/api/activity/today", {
      token: bearerFor("u-operator"),
    });
    assert.equal(r.status, 200);
    assert.equal(r.body?.ok, true);
    assert.ok((r.body?.total_active_seconds || 0) >= 60, JSON.stringify(r.body));
  });
});
