// ═══════════════════════════════════════════════════════════════════════════
// tests/tasksSync.test.js — regression tests for Google Tasks sync auth paths
// ───────────────────────────────────────────────────────────────────────────
// Run: node --test tests/tasksSync.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { config } from "../server/config.js";
import { __test__ } from "../server/routes/tasksSync.js";

const { syncUser, verifyHmacSignature } = __test__;

const GOOGLE_LISTS_URL = "https://www.googleapis.com/tasks/v1/users/@me/lists";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const originalFetch = globalThis.fetch;
const originalConfig = {
  googleTasksClientId: config.googleTasksClientId,
  googleTasksClientSecret: config.googleTasksClientSecret,
  supabasePgpEncryptKey: config.supabasePgpEncryptKey,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makePool({ accessToken = "old-access-token", refreshToken = "refresh-token-12345" } = {}) {
  const state = {
    accessToken,
    refreshToken,
    revoked: false,
    updates: [],
    logs: [],
  };

  const pool = {
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (norm.includes("select pgp_sym_decrypt($1::bytea")) {
        return { rows: [{ token: state.accessToken }] };
      }

      if (norm.includes("select pgp_sym_decrypt(refresh_token_encrypted::bytea")) {
        return { rows: [{ rt: state.refreshToken }] };
      }

      if (norm.startsWith("update tasks.oauth_tokens set access_token_encrypted")) {
        state.accessToken = params[0];
        state.refreshToken = params[1] || state.refreshToken;
        state.updates.push({ kind: "token_update", params });
        return { rows: [] };
      }

      if (norm.startsWith("update tasks.oauth_tokens set revoked_at")) {
        state.revoked = true;
        state.updates.push({ kind: "revoke", params });
        return { rows: [] };
      }

      if (norm.startsWith("insert into tasks.sync_log")) {
        const statusMatch = sql.match(/,\s*(\d+)\)\s*$/m);
        state.logs.push({
          eventType: sql.match(/values \(\$1, \$2, '([^']+)'/i)?.[1]
            || sql.match(/values \(\$1, gen_random_uuid\(\)::text, '([^']+)'/i)?.[1]
            || "unknown",
          details: params[2] ? JSON.parse(params[2]) : JSON.parse(params[1] || "{}"),
          httpStatusCode: params[3] ?? (statusMatch ? Number(statusMatch[1]) : null),
        });
        return { rows: [] };
      }

      throw new Error(`unhandled SQL in tasksSync test: ${norm}`);
    },
    _state: state,
  };

  return pool;
}

function installFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({
      url: href,
      authorization: init.headers?.Authorization || init.headers?.authorization || null,
    });
    return handler(href, init, calls);
  };
  return calls;
}

async function runSync(pool) {
  return syncUser({
    pool,
    userId: "user-1234",
    encryptedAccessToken: Buffer.from("encrypted-access-token"),
    cycleId: "cycle-test",
  });
}

beforeEach(() => {
  config.googleTasksClientId = "tasks-client-id";
  config.googleTasksClientSecret = "tasks-client-secret";
  config.supabasePgpEncryptKey = "test-pgp-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.googleTasksClientId = originalConfig.googleTasksClientId;
  config.googleTasksClientSecret = originalConfig.googleTasksClientSecret;
  config.supabasePgpEncryptKey = originalConfig.supabasePgpEncryptKey;
});

describe("tasksSync — raw scheduler secret verification", () => {
  it("accepts only the exact raw X-Sync-Signature value", () => {
    assert.equal(verifyHmacSignature("shared-secret", "shared-secret"), true);
    assert.equal(verifyHmacSignature("shared-secret ", "shared-secret"), false);
    assert.equal(verifyHmacSignature("", "shared-secret"), false);
    assert.equal(verifyHmacSignature("shared-secret", ""), false);
  });
});

describe("tasksSync — Google 401 refresh classification", () => {
  it("preserves oauth token when refresh fails transiently", async () => {
    const pool = makePool();
    installFetch((url) => {
      if (url === GOOGLE_LISTS_URL) {
        return jsonResponse({ error: { code: 401, message: "expired" } }, 401);
      }
      if (url === GOOGLE_TOKEN_URL) {
        return jsonResponse({ error: "temporarily_unavailable" }, 503);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runSync(pool);

    assert.deepEqual(result, {
      itemsSynced: 0,
      conflicts: 0,
      listsTouched: 0,
      transient: true,
    });
    assert.equal(pool._state.revoked, false);
    assert.equal(pool._state.updates.some((u) => u.kind === "revoke"), false);
    assert.equal(pool._state.logs.length, 1);
    assert.equal(pool._state.logs[0].eventType, "sync_failed");
    assert.equal(pool._state.logs[0].httpStatusCode, 401);
    assert.equal(pool._state.logs[0].details.reason, "google_401_transient_refresh_failure");
    assert.equal(pool._state.logs[0].details.refresh_status, 503);
  });

  it("revokes oauth token when Google rejects the refresh token", async () => {
    const pool = makePool();
    installFetch((url) => {
      if (url === GOOGLE_LISTS_URL) {
        return jsonResponse({ error: { code: 401, message: "expired" } }, 401);
      }
      if (url === GOOGLE_TOKEN_URL) {
        return jsonResponse({ error: "invalid_grant" }, 400);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runSync(pool);

    assert.deepEqual(result, {
      itemsSynced: 0,
      conflicts: 0,
      listsTouched: 0,
      skipped: true,
    });
    assert.equal(pool._state.revoked, true);
    assert.equal(pool._state.logs.length, 1);
    assert.equal(pool._state.logs[0].eventType, "token_revoked");
    assert.equal(pool._state.logs[0].httpStatusCode, 401);
    assert.equal(pool._state.logs[0].details.reason, "google_401_permanent");
    assert.equal(pool._state.logs[0].details.refresh_body.error, "invalid_grant");
  });

  it("retries the list pull with the refreshed access token", async () => {
    const pool = makePool();
    let listAttempts = 0;
    const calls = installFetch((url) => {
      if (url === GOOGLE_LISTS_URL) {
        listAttempts += 1;
        return listAttempts === 1
          ? jsonResponse({ error: { code: 401, message: "expired" } }, 401)
          : jsonResponse({ items: [] }, 200);
      }
      if (url === GOOGLE_TOKEN_URL) {
        return jsonResponse({ access_token: "fresh-access-token", expires_in: 1800 }, 200);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runSync(pool);

    assert.deepEqual(result, { itemsSynced: 0, conflicts: 0, listsTouched: 0 });
    assert.equal(pool._state.revoked, false);
    assert.equal(pool._state.accessToken, "fresh-access-token");
    assert.equal(pool._state.logs[0].eventType, "token_refreshed");
    assert.deepEqual(
      calls
        .filter((c) => c.url === GOOGLE_LISTS_URL)
        .map((c) => c.authorization),
      ["Bearer old-access-token", "Bearer fresh-access-token"],
    );
  });
});
