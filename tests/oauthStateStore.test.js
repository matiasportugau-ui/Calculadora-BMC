import assert from "node:assert/strict";
import {
  saveOauthState,
  consumeOauthState,
  _resetOauthStateStoreForTests,
} from "../server/lib/oauthStateStore.js";

// ── Fake pg pool that faithfully implements the DELETE ... RETURNING semantics
//    (atomic single-use + expiry guard) so we exercise the SQL code path. ──────
function makeFakePool() {
  const rows = new Map(); // state → { provider, code_verifier, meta, expires_at(ms) }
  return {
    queries: [],
    async query(sql, params) {
      this.queries.push(sql);
      if (/^INSERT INTO public\.oauth_state/.test(sql)) {
        const [state, provider, code_verifier, meta, expiresAtIso] = params;
        rows.set(state, {
          provider,
          code_verifier,
          meta: meta ? JSON.parse(meta) : null,
          expires_at: new Date(expiresAtIso).getTime(),
        });
        return { rows: [] };
      }
      if (/^DELETE FROM public\.oauth_state/.test(sql)) {
        const state = params[0];
        const provider = params[1]; // undefined when no provider filter
        const row = rows.get(state);
        if (!row) return { rows: [] };
        if (row.expires_at <= Date.now()) {
          rows.delete(state);
          return { rows: [] };
        }
        if (provider && row.provider !== provider) return { rows: [] };
        rows.delete(state); // single-use
        return { rows: [{ provider: row.provider, code_verifier: row.code_verifier, meta: row.meta }] };
      }
      throw new Error("unexpected SQL: " + sql);
    },
  };
}

// 1. SQL path: save → consume returns the entry
{
  const pool = makeFakePool();
  await saveOauthState({ pool, state: "s1", provider: "ml", codeVerifier: "v1" });
  const got = await consumeOauthState({ pool, state: "s1", provider: "ml" });
  assert.ok(got, "first consume must return the entry");
  assert.equal(got.codeVerifier, "v1", "code verifier round-trips");
  assert.equal(got.provider, "ml");
}

// 2. SQL path: REUSE rejected (second consume → null)
{
  const pool = makeFakePool();
  await saveOauthState({ pool, state: "s2", provider: "ml", codeVerifier: "v2" });
  await consumeOauthState({ pool, state: "s2", provider: "ml" });
  const second = await consumeOauthState({ pool, state: "s2", provider: "ml" });
  assert.equal(second, null, "reusing a consumed state must be rejected");
}

// 3. SQL path: expired state → null
{
  const pool = makeFakePool();
  await saveOauthState({ pool, state: "s3", provider: "ml", codeVerifier: "v3", ttlMs: -1000 });
  const got = await consumeOauthState({ pool, state: "s3", provider: "ml" });
  assert.equal(got, null, "expired state must be rejected");
}

// 4. SQL path: provider mismatch → null (cross-provider state cannot be consumed)
{
  const pool = makeFakePool();
  await saveOauthState({ pool, state: "s4", provider: "shopify", codeVerifier: "v4", meta: { shop: "x.myshopify.com" } });
  const wrong = await consumeOauthState({ pool, state: "s4", provider: "ml" });
  assert.equal(wrong, null, "provider mismatch must be rejected");
  const right = await consumeOauthState({ pool, state: "s4", provider: "shopify" });
  assert.ok(right, "matching provider consumes");
  assert.equal(right.meta.shop, "x.myshopify.com", "meta round-trips");
}

// 5. In-memory fallback (no DATABASE_URL): same single-use contract
{
  await _resetOauthStateStoreForTests();
  await saveOauthState({ state: "m1", provider: "ml", codeVerifier: "mv1" });
  const first = await consumeOauthState({ state: "m1", provider: "ml" });
  assert.ok(first, "in-memory: first consume returns entry");
  assert.equal(first.codeVerifier, "mv1");
  const second = await consumeOauthState({ state: "m1", provider: "ml" });
  assert.equal(second, null, "in-memory: reuse rejected");
}

// 6. Unknown state → null
{
  assert.equal(await consumeOauthState({ state: "does-not-exist" }), null, "unknown state → null");
}

await _resetOauthStateStoreForTests();
console.log("oauthStateStore tests OK (6/6)");
