/**
 * Developer-mode HTTP auth. Run: node tests/devModeAuthGates.test.js
 *
 * Pins checkDevModeAuthorization: relax bypass, missing token is 503 before
 * any credential compare, bearer is case-sensitive, and a wrong X-Api-Key
 * hides a correct query key.
 */
import assert from "node:assert/strict";
import { config } from "../server/config.js";
import {
  checkDevModeAuthorization,
  requireDevModeAuthMiddleware,
} from "../server/lib/devModeAuth.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const prevRelax = config.panelinRelaxDevAuth;
const prevToken = config.apiAuthToken;
const TOKEN = "dev-mode-secret";

function check(headers = {}, query) {
  return checkDevModeAuthorization({ headers, query });
}

function runMw(req) {
  let nextCalled = 0;
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
  requireDevModeAuthMiddleware(req, res, () => { nextCalled += 1; });
  return { nextCalled, statusCode, body };
}

console.log("devModeAuth gates");

try {
  config.panelinRelaxDevAuth = true;
  config.apiAuthToken = "";
  assert.deepEqual(check({}, {}), { ok: true });
  assert.deepEqual(check({ authorization: "Bearer nope" }), { ok: true });
  const relaxed = runMw({ headers: {} });
  assert.equal(relaxed.nextCalled, 1);
  assert.equal(relaxed.statusCode, null);
  ok("relax flag skips the token even when it is unset");

  config.panelinRelaxDevAuth = false;
  config.apiAuthToken = "";
  const disabled = check({ authorization: "Bearer dev-mode-secret", "x-api-key": TOKEN }, { key: TOKEN });
  assert.deepEqual(disabled, {
    ok: false,
    status: 503,
    error: "API_AUTH_TOKEN not configured — developer mode disabled",
  });
  const mwDisabled = runMw({ headers: { authorization: `Bearer ${TOKEN}` }, query: {} });
  assert.equal(mwDisabled.nextCalled, 0);
  assert.equal(mwDisabled.statusCode, 503);
  assert.equal(mwDisabled.body.ok, false);
  assert.match(mwDisabled.body.error, /not configured/);
  ok("empty token is 503 before bearer or key is compared");

  config.apiAuthToken = TOKEN;
  assert.deepEqual(check({}), { ok: false, status: 401, error: "Unauthorized developer mode" });
  assert.deepEqual(check({ authorization: `Bearer ${TOKEN}` }), { ok: true });
  assert.deepEqual(check({ authorization: `Bearer  ${TOKEN}  ` }), { ok: true });
  assert.equal(check({ authorization: `bearer ${TOKEN}` }).status, 401);
  assert.equal(check({ authorization: `Bearer\t${TOKEN}` }).status, 401);
  assert.equal(check({ authorization: `Bearer ${TOKEN}-extra` }).status, 401);
  assert.equal(check({ authorization: `Bearer ${TOKEN.toUpperCase()}` }).status, 401);
  assert.deepEqual(check({ "x-api-key": `  ${TOKEN}  ` }), { ok: true });
  assert.deepEqual(check({}, { key: TOKEN }), { ok: true });
  assert.equal(check({ "x-api-key": "nope" }, { key: TOKEN }).status, 401);
  assert.equal(check({ "x-api-key": "   " }, { key: TOKEN }).status, 401);
  assert.equal(check({ "X-Api-Key": TOKEN }).status, 401);
  assert.deepEqual(check({ authorization: "Bearer wrong", "x-api-key": TOKEN }), { ok: true });
  ok("bearer trim, case, query key, and wrong header hiding the query");

  const mwOk = runMw({ headers: { "x-api-key": TOKEN } });
  assert.equal(mwOk.nextCalled, 1);
  assert.equal(mwOk.body, null);
  const mwDeny = runMw({ headers: { authorization: "Bearer nope" }, query: {} });
  assert.equal(mwDeny.nextCalled, 0);
  assert.equal(mwDeny.statusCode, 401);
  assert.deepEqual(mwDeny.body, { ok: false, error: "Unauthorized developer mode" });
  ok("middleware calls next only when the check passes");
} finally {
  config.panelinRelaxDevAuth = prevRelax;
  config.apiAuthToken = prevToken;
}

console.log(`devModeAuth gates: ${passed} passed`);
