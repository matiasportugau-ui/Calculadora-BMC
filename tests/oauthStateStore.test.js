// Offline tests for the persistent, single-use OAuth state store.
// Uses an in-memory pg.Pool shim injected via __test__.setPool — no live DB.
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { oauthStateStore, __test__ } from "../server/lib/oauthStateStore.js";

// Minimal pg shim backing public.oauth_states. The query body runs fully
// synchronously, so the consume UPDATE is atomic with respect to JS's
// single-threaded event loop (models the SQL atomic single-use guarantee).
function makeShim() {
  const rows = new Map(); // state -> { payload, expires_at: Date, consumed_at: Date|null }

  function norm(sql) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  async function query(sql, params = []) {
    const q = norm(sql);

    if (q.startsWith("insert into public.oauth_states")) {
      const [state, payload, expiresAt] = params;
      rows.set(state, { payload, expires_at: new Date(expiresAt), consumed_at: null });
      return { rows: [] };
    }

    if (q.startsWith("update public.oauth_states set consumed_at = now()")) {
      const [state] = params;
      const row = rows.get(state);
      if (!row || row.consumed_at || row.expires_at <= new Date()) return { rows: [] };
      row.consumed_at = new Date();
      return { rows: [{ payload: row.payload }] };
    }

    if (q.startsWith("delete from public.oauth_states where state =")) {
      rows.delete(params[0]);
      return { rows: [] };
    }

    if (q.startsWith("delete from public.oauth_states where expires_at < now()")) {
      for (const [k, v] of rows) if (v.expires_at < new Date()) rows.delete(k);
      return { rows: [] };
    }

    throw new Error(`unhandled SQL in shim: ${q.slice(0, 120)}`);
  }

  return { query, _rows: rows };
}

describe("oauthStateStore — single-use consume", () => {
  let shim;

  beforeEach(() => {
    shim = makeShim();
    __test__.setPool(shim);
  });

  afterEach(() => {
    __test__.reset();
  });

  it("consumes a valid state exactly once; a second consume is rejected (reuse)", async () => {
    await oauthStateStore.set("s1", { codeVerifier: "v1" });

    const first = await oauthStateStore.consume("s1");
    assert.deepEqual(first, { codeVerifier: "v1" }, "first consume returns the payload");

    const second = await oauthStateStore.consume("s1");
    assert.equal(second, null, "reused state must be rejected");
  });

  it("rejects an expired state", async () => {
    await oauthStateStore.set("s-exp", { codeVerifier: "v" });
    // Force expiry in the shim row.
    shim._rows.get("s-exp").expires_at = new Date(Date.now() - 1000);

    assert.equal(await oauthStateStore.consume("s-exp"), null);
  });

  it("rejects an unknown state", async () => {
    assert.equal(await oauthStateStore.consume("does-not-exist"), null);
  });

  it("concurrency: two simultaneous consumes of the same state — exactly one wins", async () => {
    await oauthStateStore.set("s-race", { codeVerifier: "race" });

    const results = await Promise.allSettled([
      oauthStateStore.consume("s-race"),
      oauthStateStore.consume("s-race"),
    ]);

    const payloads = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    const winners = payloads.filter((p) => p !== null);
    const losers = payloads.filter((p) => p === null);

    assert.equal(winners.length, 1, "exactly one concurrent consume must win");
    assert.equal(losers.length, 1, "the other must be rejected");
    assert.deepEqual(winners[0], { codeVerifier: "race" });
  });

  it("re-issuing a state (set on conflict) clears the consumed flag", async () => {
    await oauthStateStore.set("s2", { codeVerifier: "a" });
    await oauthStateStore.consume("s2");
    await oauthStateStore.set("s2", { codeVerifier: "b" }); // overwrite resets consumed_at

    assert.deepEqual(await oauthStateStore.consume("s2"), { codeVerifier: "b" });
  });
});
