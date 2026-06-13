import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import createShopifyRouter from "../server/routes/shopify.js";
import { __test__ as oauthStateStoreTest } from "../server/lib/oauthStateStore.js";

function makeOauthStateShim() {
  return {
    rows: new Map(),
    async query(sql, params = []) {
      const q = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (q.startsWith("insert into public.oauth_states")) {
        const [state, payload, expiresAt] = params;
        this.rows.set(state, { payload, expiresAt });
        return { rows: [] };
      }
      throw new Error(`unhandled SQL in oauth shim: ${q.slice(0, 120)}`);
    },
  };
}

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

describe("Shopify OAuth state cookie", () => {
  let server;
  let port;

  before(async () => {
    const app = express();
    app.use(createShopifyRouter({
      shopifyClientId: "test-shopify-client",
      shopifyClientSecret: "test-shopify-secret",
      shopifyScopes: "read_products",
      shopifyWebhookSecret: "test-webhook-secret",
      publicBaseUrl: "https://panelin.example.test",
      tokenEncryptionKey: "test-token-encryption-key",
    }, { warn() {}, info() {}, error() {} }));

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    oauthStateStoreTest.setPool(makeOauthStateShim());
  });

  afterEach(() => {
    oauthStateStoreTest.reset();
  });

  it("sets an OAuth-compatible state cookie before redirecting to Shopify", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/auth/shopify?shop=bmc-test.myshopify.com`, {
      redirect: "manual",
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get("location") || "", /^https:\/\/bmc-test\.myshopify\.com\/admin\/oauth\/authorize\?/);

    const cookie = getSetCookie(response.headers).find((line) => line.startsWith("shopify_oauth="));
    assert.ok(cookie, "shopify_oauth Set-Cookie header expected");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Max-Age=600/i);
    assert.doesNotMatch(cookie, /SameSite=Strict/i);
    assert.doesNotMatch(cookie, /Max-Age=0|Max-Age=1/i);
  });
});
