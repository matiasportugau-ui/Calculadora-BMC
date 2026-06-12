// Security regressions for the new Panelin Platform / FacturaExpress surface.
// Run: node --test tests/panelinSecurity.test.js

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";

import createPanelinRouter from "../server/routes/panelin.js";
import webhooksRouter from "../server/routes/webhooks.js";
import facturaExpress from "../server/lib/facturaExpressClient.js";

const ORIGINAL_ENV = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  FACTURAEXPRESS_WEBHOOK_SECRET: process.env.FACTURAEXPRESS_WEBHOOK_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
});

async function withPanelinServer(config, fn) {
  const app = express();
  app.use(express.json());
  app.use("/api/panelin", createPanelinRouter(config, console));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}/api/panelin`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function withWebhookServer(fn) {
  const app = express();
  app.use("/webhooks", express.raw({ type: "application/json" }), webhooksRouter);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}/webhooks`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("Panelin Platform auth gate", () => {
  it("leaves /status public but protects data-bearing routes", async () => {
    await withPanelinServer({ apiAuthToken: "panelin-test-token", databaseUrl: "" }, async (baseUrl) => {
      const statusRes = await fetch(`${baseUrl}/status`);
      assert.equal(statusRes.status, 503, "/status should reach the DB availability check, not auth");

      const productsRes = await fetch(`${baseUrl}/products`);
      assert.equal(productsRes.status, 401);
      assert.equal((await productsRes.json()).error, "Unauthorized");

      const invoicesRes = await fetch(`${baseUrl}/invoices`);
      assert.equal(invoicesRes.status, 401);
      assert.equal((await invoicesRes.json()).error, "Unauthorized");
    });
  });

  it("allows the configured service token to pass the auth gate", async () => {
    await withPanelinServer({ apiAuthToken: "panelin-test-token", databaseUrl: "" }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/products`, {
        headers: { "X-Api-Key": "panelin-test-token" },
      });
      assert.equal(res.status, 503, "authenticated request should reach the DB availability check");
      assert.equal((await res.json()).error, "panelin_db_unavailable");
    });
  });
});

describe("FacturaExpress webhook signatures", () => {
  it("fails closed when the webhook secret is missing outside tests", () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    delete process.env.FACTURAEXPRESS_WEBHOOK_SECRET;

    const result = facturaExpress.verifyWebhookSignature(Buffer.from("{}"), "");

    assert.equal(result.ok, false);
    assert.equal(result.skipped, false);
    assert.equal(result.reason, "secret_not_configured");
  });

  it("does not throw on malformed signature length", () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    process.env.FACTURAEXPRESS_WEBHOOK_SECRET = "test-secret";

    const result = facturaExpress.verifyWebhookSignature(Buffer.from("{}"), "not-a-valid-hmac");

    assert.equal(result.ok, false);
    assert.equal(result.reason, "length_mismatch");
  });

  it("accepts a valid HMAC signature", () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    process.env.FACTURAEXPRESS_WEBHOOK_SECRET = "test-secret";
    const body = Buffer.from('{"event":"invoice.issued"}');
    const signature =
      "sha256=" + crypto.createHmac("sha256", "test-secret").update(body).digest("hex");

    const result = facturaExpress.verifyWebhookSignature(body, signature);

    assert.equal(result.ok, true);
    assert.equal(result.skipped, false);
  });

  it("returns 503 at the webhook route when the production secret is missing", async () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    delete process.env.FACTURAEXPRESS_WEBHOOK_SECRET;

    await withWebhookServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/facturaexpress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      assert.equal(res.status, 503);
      assert.equal((await res.json()).error, "facturaexpress_webhook_secret_not_configured");
    });
  });

  it("returns 401 instead of 500 for malformed webhook signatures", async () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    process.env.FACTURAEXPRESS_WEBHOOK_SECRET = "test-secret";

    await withWebhookServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/facturaexpress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature": "bad",
        },
        body: "{}",
      });

      assert.equal(res.status, 401);
      assert.equal((await res.json()).error, "invalid_signature");
    });
  });
});
