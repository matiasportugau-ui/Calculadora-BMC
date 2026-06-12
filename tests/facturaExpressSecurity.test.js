import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";

process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "panelin_service_token_test";

const { config } = await import("../server/config.js");
const { default: facturaExpress } = await import("../server/lib/facturaExpressClient.js");
const { default: createPanelinRouter } = await import("../server/routes/panelin.js");

const originalEnv = {
  appEnv: config.appEnv,
  apiAuthToken: config.apiAuthToken,
  facturaexpressWebhookSecret: config.facturaexpressWebhookSecret,
};

before(() => {
  config.appEnv = "test";
  config.apiAuthToken = "panelin_service_token_test";
  config.facturaexpressWebhookSecret = "";
});

after(() => {
  config.appEnv = originalEnv.appEnv;
  config.apiAuthToken = originalEnv.apiAuthToken;
  config.facturaexpressWebhookSecret = originalEnv.facturaexpressWebhookSecret;
});

function signedHeader(raw, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
}

describe("FacturaExpress webhook signature verification", () => {
  it("accepts a valid sha256-prefixed HMAC signature", () => {
    const raw = Buffer.from(JSON.stringify({ event: "invoice.issued", data: { id: "fe-1" } }));
    config.facturaexpressWebhookSecret = "fe_webhook_secret";

    const result = facturaExpress.verifyWebhookSignature(raw, signedHeader(raw, "fe_webhook_secret"));

    assert.equal(result.skipped, false);
    assert.equal(result.ok, true);
  });

  it("accepts a valid raw hex HMAC signature", () => {
    const raw = Buffer.from(JSON.stringify({ event: "invoice.issued", data: { id: "fe-2" } }));
    config.facturaexpressWebhookSecret = "fe_webhook_secret";
    const signature = signedHeader(raw, "fe_webhook_secret").slice("sha256=".length);

    const result = facturaExpress.verifyWebhookSignature(raw, signature);

    assert.equal(result.skipped, false);
    assert.equal(result.ok, true);
  });

  it("rejects invalid signatures without throwing", () => {
    const raw = Buffer.from(JSON.stringify({ event: "invoice.issued", data: { id: "fe-3" } }));
    config.facturaexpressWebhookSecret = "fe_webhook_secret";

    const result = facturaExpress.verifyWebhookSignature(raw, "sha256=bad");

    assert.equal(result.skipped, false);
    assert.equal(result.ok, false);
  });

  it("fails closed without a secret outside test environments", () => {
    const previousAppEnv = process.env.APP_ENV;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    config.facturaexpressWebhookSecret = "";

    try {
      const result = facturaExpress.verifyWebhookSignature(Buffer.from("{}"), "");
      assert.deepEqual(result, {
        skipped: false,
        ok: false,
        reason: "secret_not_configured",
      });
    } finally {
      process.env.APP_ENV = previousAppEnv;
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});

describe("Panelin public mutation routes", () => {
  let server;
  let port;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/panelin", createPanelinRouter({ ...config, databaseUrl: "" }, { error() {}, warn() {} }));
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function request(path, init = {}) {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      ...init,
    });
  }

  it("rejects stock mutations without service credentials before DB access", async () => {
    const res = await request("/api/panelin/stock/movements", {
      method: "POST",
      body: JSON.stringify({ sku: "SKU-1", delta: -1 }),
    });

    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "service_token_required");
  });

  it("rejects FacturaExpress sync mutations without service credentials", async () => {
    const res = await request("/api/panelin/sync/facturaexpress/stock", {
      method: "POST",
      body: JSON.stringify({ sku: "SKU-1", pushDelta: -1 }),
    });

    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "service_token_required");
  });

  it("allows service credentials through to the existing DB availability guard", async () => {
    const res = await request("/api/panelin/stock/movements", {
      method: "POST",
      headers: { Authorization: "Bearer panelin_service_token_test" },
      body: JSON.stringify({ sku: "SKU-1", delta: -1 }),
    });

    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, "panelin_db_unavailable");
  });
});
