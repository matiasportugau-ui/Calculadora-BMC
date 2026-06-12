import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { config } from "../server/config.js";
import facturaExpress from "../server/lib/facturaExpressClient.js";

const original = {
  appEnv: config.appEnv,
  facturaexpressWebhookSecret: config.facturaexpressWebhookSecret,
};

afterEach(() => {
  config.appEnv = original.appEnv;
  config.facturaexpressWebhookSecret = original.facturaexpressWebhookSecret;
});

describe("FacturaExpress webhook signature verification", () => {
  it("accepts a valid sha256-prefixed HMAC header", () => {
    config.appEnv = "production";
    config.facturaexpressWebhookSecret = "test-secret";

    const raw = Buffer.from(JSON.stringify({ event: "invoice.issued", data: { external_id: "A-1" } }));
    const digest = crypto.createHmac("sha256", "test-secret").update(raw).digest("hex");

    assert.deepEqual(facturaExpress.verifyWebhookSignature(raw, `sha256=${digest}`), {
      ok: true,
      skipped: false,
    });
  });

  it("rejects unsigned production webhooks when the shared secret is missing", () => {
    config.appEnv = "production";
    config.facturaexpressWebhookSecret = "";

    assert.deepEqual(facturaExpress.verifyWebhookSignature(Buffer.from("{}"), ""), {
      ok: false,
      skipped: false,
      reason: "missing_secret",
    });
  });
});
