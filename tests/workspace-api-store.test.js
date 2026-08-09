/**
 * tests/workspace-api-store.test.js
 *
 * HTTP get-after-set through real Express routes:
 *   POST/GET /api/workspace/customers|quotes|files
 *
 * Auth: identity JWT + in-memory identity shim for requireUser().
 * Data: real Postgres via DATABASE_URL (same as workspace-store.test.js).
 *
 * Run: node --test tests/workspace-api-store.test.js
 */
import dotenv from "dotenv";
dotenv.config();

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import pg from "pg";

// Identity secret for signing test Bearer tokens (must be ≥32 chars).
if (!process.env.IDENTITY_JWT_SECRET || process.env.IDENTITY_JWT_SECRET.length < 32) {
  process.env.IDENTITY_JWT_SECRET = "test_workspace_api_store_secret_32chars_xx";
}
process.env.APP_ENV = process.env.APP_ENV || "test";
// Avoid cross-system secret collision guard if WA secret is set equal.
if (process.env.WA_JWT_SECRET === process.env.IDENTITY_JWT_SECRET) {
  process.env.WA_JWT_SECRET = "wa_test_secret_different_from_identity_xx";
}

const databaseUrl = process.env.DATABASE_URL;
const hasDb = Boolean(databaseUrl);

const identityAuth = await import("../server/lib/identityAuth.js");
const createWorkspaceRouter = (await import("../server/routes/workspace.js")).default;

const TEST_USER_ID = "u-ws-api-store-test";
const JWT_ISSUER = "bmc-identity";
const JWT_AUDIENCE = "bmc-identity-api";

function makeIdentityShim() {
  const user = {
    user_id: TEST_USER_ID,
    email: "ws-api-store@example.com",
    name: "WS API Store Test",
    picture_url: null,
    avatar_preset: null,
    plan_tier: "plus",
    status: "active",
    jwt_revoked_at: null,
  };
  return {
    async query(sql, params = []) {
      const norm = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
        return { rows: params[0] === TEST_USER_ID ? [user] : [] };
      }
      if (norm.startsWith("select role from identity.role_grants")) {
        return { rows: params[0] === TEST_USER_ID ? [{ role: "operator" }] : [] };
      }
      if (norm.startsWith("select module, level from identity.module_grants")) {
        return { rows: [] };
      }
      if (norm.startsWith("update identity.users set last_active_at")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function signAccessToken() {
  return jwt.sign(
    { sub: TEST_USER_ID, sid: "sess-ws-api-store" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: "15m",
    },
  );
}

function requestJson(port, method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
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
    if (data) req.write(data);
    req.end();
  });
}

describe("workspace HTTP API customers/quotes/files", { skip: !hasDb }, () => {
  /** @type {import("pg").Pool} */
  let pool;
  /** @type {import("http").Server} */
  let server;
  let port;
  let token;
  const stamp = Date.now();

  before(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

    // Ensure seed workspace parent exists (FK)
    const { rows } = await pool.query(
      `SELECT id FROM panelin_workspace.workspaces WHERE id = $1`,
      ["ws-1"],
    );
    if (!rows.length) {
      await pool.query(
        `INSERT INTO panelin_workspace.ws_users (id, email, display_name, role)
         VALUES ('u-store-test', 'store-test@example.com', 'Store Test', 'superadmin')
         ON CONFLICT (id) DO NOTHING`,
      );
      await pool.query(
        `INSERT INTO panelin_workspace.workspaces (id, owner_user_id, name, agent_config_id)
         VALUES ('ws-1', 'u-store-test', 'Store Test WS', 'cfg-1')
         ON CONFLICT (id) DO NOTHING`,
      );
    }

    identityAuth.__test__.reset();
    identityAuth.initIdentityAuth({
      pool: makeIdentityShim(),
      logger: { warn() {}, error() {}, info() {} },
    });
    token = signAccessToken();

    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(
      createWorkspaceRouter(
        { databaseUrl },
        { warn() {}, error() {}, info() {} },
        { pool },
      ),
    );

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (pool) await pool.end();
    identityAuth.__test__.reset();
  });

  it("POST without auth → 401", async () => {
    const res = await requestJson(port, "POST", "/api/workspace/customers", {
      body: { name: "No Auth" },
    });
    assert.equal(res.status, 401);
    assert.equal(res.body?.ok, false);
  });

  it("POST customer → GET customer (HTTP get-after-set)", async () => {
    const name = `HTTP Cliente ${stamp}`;
    const created = await requestJson(port, "POST", "/api/workspace/customers", {
      token,
      body: {
        workspaceId: "ws-1",
        name,
        rut: "21.111.111-1",
        phone: "+59899111111",
        source: "api-test",
        tags: ["http-test"],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body?.ok, true);
    assert.ok(created.body?.customer?.id, "customer id");
    assert.equal(created.body.customer.name, name);

    const got = await requestJson(
      port,
      "GET",
      `/api/workspace/customers/${created.body.customer.id}`,
      { token },
    );
    assert.equal(got.status, 200, JSON.stringify(got.body));
    assert.equal(got.body?.ok, true);
    assert.equal(got.body.customer.id, created.body.customer.id);
    assert.equal(got.body.customer.name, name);
    assert.equal(got.body.customer.rut, "21.111.111-1");
  });

  it("POST quote linked to customer → GET quote", async () => {
    const cust = await requestJson(port, "POST", "/api/workspace/customers", {
      token,
      body: { workspaceId: "ws-1", name: `HTTP Quote Cust ${stamp}` },
    });
    assert.equal(cust.status, 201, JSON.stringify(cust.body));
    const customerId = cust.body.customer.id;

    const created = await requestJson(port, "POST", "/api/workspace/quotes", {
      token,
      body: {
        workspaceId: "ws-1",
        customerId,
        title: `Cotización HTTP ${stamp}`,
        status: "draft",
        currency: "USD",
        totalConIva: 1234.5,
        payloadJson: { panels: 10 },
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.ok(created.body?.quote?.id);
    assert.equal(created.body.quote.customerId, customerId);

    const got = await requestJson(
      port,
      "GET",
      `/api/workspace/quotes/${created.body.quote.id}`,
      { token },
    );
    assert.equal(got.status, 200, JSON.stringify(got.body));
    assert.equal(got.body.quote.id, created.body.quote.id);
    assert.equal(got.body.quote.customerId, customerId);
    assert.equal(got.body.quote.title, `Cotización HTTP ${stamp}`);
  });

  it("POST file linked to customer+quote → GET + list by quoteId", async () => {
    const cust = await requestJson(port, "POST", "/api/workspace/customers", {
      token,
      body: { workspaceId: "ws-1", name: `HTTP File Cust ${stamp}` },
    });
    assert.equal(cust.status, 201, JSON.stringify(cust.body));
    const customerId = cust.body.customer.id;

    const quote = await requestJson(port, "POST", "/api/workspace/quotes", {
      token,
      body: {
        workspaceId: "ws-1",
        customerId,
        title: `File Quote ${stamp}`,
      },
    });
    assert.equal(quote.status, 201, JSON.stringify(quote.body));
    const quoteId = quote.body.quote.id;

    const created = await requestJson(port, "POST", "/api/workspace/files", {
      token,
      body: {
        workspaceId: "ws-1",
        customerId,
        quoteId,
        name: `presupuesto-${stamp}.pdf`,
        path: `/quotes/presupuesto-${stamp}.pdf`,
        mime: "application/pdf",
        size: 2048,
        kind: "quote_pdf",
        storageUrl: `https://example.test/files/${stamp}.pdf`,
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.ok(created.body?.file?.id);
    assert.equal(created.body.file.customerId, customerId);
    assert.equal(created.body.file.quoteId, quoteId);
    assert.equal(created.body.file.kind, "quote_pdf");

    const got = await requestJson(
      port,
      "GET",
      `/api/workspace/files/${created.body.file.id}`,
      { token },
    );
    assert.equal(got.status, 200, JSON.stringify(got.body));
    assert.equal(got.body.file.id, created.body.file.id);

    const listed = await requestJson(
      port,
      "GET",
      `/api/workspace/files?quoteId=${encodeURIComponent(quoteId)}`,
      { token },
    );
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body?.ok, true);
    assert.ok(Array.isArray(listed.body.files));
    assert.ok(
      listed.body.files.some((f) => f.id === created.body.file.id),
      "list by quoteId includes created file",
    );
  });
});
