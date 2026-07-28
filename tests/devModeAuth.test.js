/**
 * Shared Panelin developer-mode auth (#783 obs-summary + training KB + stats).
 * Locks fail-closed behavior when PANELIN_RELAX_DEV_AUTH is off.
 *
 * Run: node --test tests/devModeAuth.test.js
 */

import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../server/config.js";
import {
  checkDevModeAuthorization,
  requireDevModeAuthMiddleware,
} from "../server/lib/devModeAuth.js";

const TOKEN = "dev-mode-auth-test-token";

function withAuthConfig(fn) {
  const prev = {
    relax: config.panelinRelaxDevAuth,
    token: config.apiAuthToken,
  };
  config.panelinRelaxDevAuth = false;
  config.apiAuthToken = TOKEN;
  try {
    return fn();
  } finally {
    config.panelinRelaxDevAuth = prev.relax;
    config.apiAuthToken = prev.token;
  }
}

test("relax mode accepts any request without a token check", () => {
  const prev = {
    relax: config.panelinRelaxDevAuth,
    token: config.apiAuthToken,
  };
  config.panelinRelaxDevAuth = true;
  config.apiAuthToken = "";
  try {
    assert.deepEqual(checkDevModeAuthorization({ headers: {} }), { ok: true });
  } finally {
    config.panelinRelaxDevAuth = prev.relax;
    config.apiAuthToken = prev.token;
  }
});

test("missing API_AUTH_TOKEN fails closed with 503", () => {
  const prev = {
    relax: config.panelinRelaxDevAuth,
    token: config.apiAuthToken,
  };
  config.panelinRelaxDevAuth = false;
  config.apiAuthToken = "";
  try {
    const r = checkDevModeAuthorization({ headers: {} });
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
    assert.match(String(r.error), /API_AUTH_TOKEN/);
  } finally {
    config.panelinRelaxDevAuth = prev.relax;
    config.apiAuthToken = prev.token;
  }
});

test("accepts Bearer and X-Api-Key; rejects wrong or missing credentials", () => {
  withAuthConfig(() => {
    assert.equal(checkDevModeAuthorization({ headers: {} }).status, 401);
    assert.equal(
      checkDevModeAuthorization({
        headers: { authorization: "Bearer wrong" },
      }).status,
      401,
    );
    assert.deepEqual(
      checkDevModeAuthorization({
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
      { ok: true },
    );
    assert.deepEqual(
      checkDevModeAuthorization({
        headers: { "x-api-key": TOKEN },
      }),
      { ok: true },
    );
    assert.deepEqual(
      checkDevModeAuthorization({
        headers: {},
        query: { key: TOKEN },
      }),
      { ok: true },
    );
  });
});

test("requireDevModeAuthMiddleware writes JSON error and skips next on failure", () => {
  withAuthConfig(() => {
    let nextCalled = false;
    let statusCode = null;
    let body = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    requireDevModeAuthMiddleware({ headers: {} }, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
    assert.equal(body?.ok, false);

    nextCalled = false;
    requireDevModeAuthMiddleware(
      { headers: { authorization: `Bearer ${TOKEN}` } },
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
  });
});
