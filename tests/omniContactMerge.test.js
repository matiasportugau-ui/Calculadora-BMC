// tests/omniContactMerge.test.js — standalone (no real DB) unit test for the
// contact-merge transaction. Run: `node tests/omniContactMerge.test.js`.
import assert from "node:assert/strict";
import { mergeContacts, ContactMergeError } from "../server/lib/omni/identity/contactMerge.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`  ok ${name}`);
  });
}

/** Minimal mock pg pool: dispatches client.query() by first-matching SQL substring. */
function makePool(handlers) {
  const calls = [];
  let releaseCount = 0;
  async function query(sql, params) {
    calls.push({ sql, params });
    for (const [needle, resp] of handlers) {
      if (sql.includes(needle)) return typeof resp === "function" ? resp(sql, params) : resp;
    }
    return { rows: [], rowCount: 0 };
  }
  return {
    calls,
    get releaseCount() {
      return releaseCount;
    },
    async connect() {
      return { query, release: () => { releaseCount += 1; } };
    },
  };
}

const BOTH_LOCKED = (fromId, intoId) => [
  "FOR UPDATE",
  { rows: [{ id: fromId }, { id: intoId }] },
];

await check("fromId === intoId throws same_contact, never opens a connection", async () => {
  const pool = makePool([]);
  await assert.rejects(
    () => mergeContacts(pool, { fromId: "a", intoId: "a" }),
    (e) => e instanceof ContactMergeError && e.code === "same_contact",
  );
  assert.equal(pool.calls.length, 0, "no query issued before the same-contact guard");
});

await check("missing ids throw missing_id", async () => {
  const pool = makePool([]);
  await assert.rejects(
    () => mergeContacts(pool, { fromId: "", intoId: "b" }),
    (e) => e instanceof ContactMergeError && e.code === "missing_id",
  );
});

await check("happy path: repoints conversations + deals, archives loser, logs audit, commits", async () => {
  const FROM = "11111111-1111-1111-1111-111111111111";
  const INTO = "22222222-2222-2222-2222-222222222222";
  const pool = makePool([
    ["FOR UPDATE", { rows: [{ id: FROM }, { id: INTO }] }],
    ["UPDATE omni_conversations", { rowCount: 3 }],
    ["UPDATE omni_deals", { rowCount: 1 }],
    ["UPDATE omni_contacts", { rowCount: 1 }],
    ["INSERT INTO omni_contact_merge_log", { rowCount: 1 }],
  ]);
  const result = await mergeContacts(pool, { fromId: FROM, intoId: INTO, performedByUserId: "op-1" });
  assert.deepEqual(result, {
    merged_from_id: FROM,
    merged_into_id: INTO,
    conversations_repointed: 3,
    deals_repointed: 1,
  });
  const sqls = pool.calls.map((c) => c.sql);
  assert.ok(sqls.some((s) => /^BEGIN/.test(s)), "BEGIN issued");
  assert.ok(sqls.some((s) => /^COMMIT/.test(s)), "COMMIT issued");
  assert.ok(!sqls.some((s) => /^ROLLBACK/.test(s)), "no ROLLBACK on success");

  const convCall = pool.calls.find((c) => c.sql.includes("UPDATE omni_conversations"));
  assert.deepEqual(convCall.params, [FROM, INTO]);

  const dealsCall = pool.calls.find((c) => c.sql.includes("UPDATE omni_deals"));
  assert.deepEqual(dealsCall.params, [FROM, INTO]);

  const archiveCall = pool.calls.find((c) => c.sql.includes("UPDATE omni_contacts"));
  assert.match(archiveCall.sql, /merged_into/);
  assert.deepEqual(archiveCall.params, [FROM, INTO]);

  const logCall = pool.calls.find((c) => c.sql.includes("INSERT INTO omni_contact_merge_log"));
  assert.deepEqual(logCall.params, [FROM, INTO, "op-1", 3, 1]);

  assert.equal(pool.releaseCount, 1, "client released exactly once");
});

await check("one contact not found → contact_not_found, rolls back, releases", async () => {
  const FROM = "11111111-1111-1111-1111-111111111111";
  const INTO = "33333333-3333-3333-3333-333333333333";
  const pool = makePool([
    // only FROM exists — INTO is missing from the locked rows
    ["FOR UPDATE", { rows: [{ id: FROM }] }],
  ]);
  await assert.rejects(
    () => mergeContacts(pool, { fromId: FROM, intoId: INTO }),
    (e) => e instanceof ContactMergeError && e.code === "contact_not_found",
  );
  const sqls = pool.calls.map((c) => c.sql);
  assert.ok(sqls.some((s) => /^ROLLBACK/.test(s)), "ROLLBACK issued");
  assert.ok(!sqls.some((s) => /^COMMIT/.test(s)), "no COMMIT");
  assert.equal(pool.releaseCount, 1, "client released even on failure");
});

await check("a mid-transaction query failure rolls back and still releases", async () => {
  const FROM = "11111111-1111-1111-1111-111111111111";
  const INTO = "22222222-2222-2222-2222-222222222222";
  const pool = makePool([
    ["FOR UPDATE", { rows: [{ id: FROM }, { id: INTO }] }],
    ["UPDATE omni_conversations", () => { throw new Error("db boom"); }],
  ]);
  await assert.rejects(() => mergeContacts(pool, { fromId: FROM, intoId: INTO }), /db boom/);
  const sqls = pool.calls.map((c) => c.sql);
  assert.ok(sqls.some((s) => /^ROLLBACK/.test(s)), "ROLLBACK issued");
  assert.equal(pool.releaseCount, 1, "client released even on a thrown query error");
});

console.log(`\nomni contactMerge: ${passed} checks passed`);
