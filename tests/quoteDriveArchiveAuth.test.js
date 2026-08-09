// ═══════════════════════════════════════════════════════════════════════════
// Security regression guard — /api/quotes/drive-archive must not be public.
// Run: node tests/quoteDriveArchiveAuth.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";

process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.API_AUTH_TOKEN = "static_service_token_xyz";

const identityAuth = await import("../server/lib/identityAuth.js");
const { config } = await import("../server/config.js");
const { createQuoteDriveArchiveRouter } = await import("../server/routes/quoteDriveArchive.js");

config.apiAuthToken = process.env.API_AUTH_TOKEN;
config.driveQuoteFolderId = "drive-folder-test";

function makeIdentityPool() {
  const user = {
    user_id: "u-active",
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

function bearerFor(userId = "u-active") {
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

const tinyPdf = Buffer.from("%PDF-1.4 test").toString("base64");
const payload = {
  pdfBase64: tinyPdf,
  projectData: { _meta: { quotationCode: "BMC-SEC-0001" }, scenario: "solo_techo" },
  quotationCode: "BMC-SEC-0001",
  proyecto: { nombre: "Cliente Test" },
};

let server;
let port;
let uploadCalls;

before(async () => {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use(
    "/api",
    createQuoteDriveArchiveRouter(config, {
      saveQuotationBundleToDrive: async (args) => {
        uploadCalls.push(args);
        return { folderUrl: "https://drive.example/folder", pdfUrl: "https://drive.example/pdf" };
      },
    }),
  );

  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  uploadCalls = [];
  identityAuth.__test__.reset();
  identityAuth.initIdentityAuth({
    pool: makeIdentityPool(),
    logger: { warn() {}, error() {}, info() {} },
  });
});

const url = (path) => `http://127.0.0.1:${port}${path}`;

describe("POST /api/quotes/drive-archive auth", () => {
  it("rejects anonymous archive attempts before Drive upload", async () => {
    const res = await fetch(url("/api/quotes/drive-archive"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.ok, false);
    assert.equal(uploadCalls.length, 0);
  });

  it("accepts the static service token for internal archive writes", async () => {
    const res = await fetch(url("/api/quotes/drive-archive"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer static_service_token_xyz",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].quotationCode, "BMC-SEC-0001");
    assert.equal(uploadCalls[0].exportedBy, "service@bmc.local");
  });

  it("accepts an active identity JWT and records the authenticated user", async () => {
    const res = await fetch(url("/api/quotes/drive-archive"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: bearerFor(),
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].exportedBy, "operator@bmc.test");
  });
});
