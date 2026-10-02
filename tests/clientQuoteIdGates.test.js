/**
 * Pins anonymous quote-id persistence used to claim rows on login.
 * Run: node tests/clientQuoteIdGates.test.js
 */
import assert from "node:assert/strict";

const KEY_CURRENT = "bmc.client_quote_id";
const KEY_LIST = "bmc.client_quote_ids";

function createMemoryStorage() {
  const data = new Map();
  const throwKeys = new Set();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (throwKeys.has(key)) throw new Error("quota");
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    throwOn(key) {
      throwKeys.add(key);
    },
  };
}

function useStorage(storage) {
  globalThis.window = { localStorage: storage };
  return storage;
}

const store = useStorage(createMemoryStorage());
const {
  getOrCreateClientQuoteId,
  rotateClientQuoteId,
  getPendingClientQuoteIds,
  clearPending,
  __resetClientQuoteIdForTests,
} = await import("../src/utils/clientQuoteId.js");

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("clientQuoteIdGates");

__resetClientQuoteIdForTests();
const first = getOrCreateClientQuoteId();
assert.equal(getOrCreateClientQuoteId(), first);
assert.equal(first.startsWith("cq_"), true);
assert.equal(first.length, 39);
assert.deepEqual(getPendingClientQuoteIds(), [first]);
ok("first id is stable, cq_-prefixed, and pending");

const rotated = rotateClientQuoteId();
assert.notEqual(rotated, first);
assert.deepEqual(getPendingClientQuoteIds(), [first, rotated]);
assert.equal(getOrCreateClientQuoteId(), rotated);
ok("rotate keeps the previous id in the claim list");

clearPending();
assert.deepEqual(getPendingClientQuoteIds(), []);
assert.equal(getOrCreateClientQuoteId(), rotated);
ok("clearPending drops the list and keeps the current id");

store.setItem(KEY_CURRENT, "cq_x");
const replaced = getOrCreateClientQuoteId();
assert.notEqual(replaced, "cq_x");
assert.equal(replaced.startsWith("cq_"), true);
assert.equal(replaced.length, 39);
ok("length 4 is below the reuse gate");

store.setItem(KEY_CURRENT, "     ");
assert.equal(getOrCreateClientQuoteId(), "     ");
ok("five spaces are reused");

store.setItem(KEY_CURRENT, "abcde");
store.setItem(KEY_LIST, JSON.stringify(["keep"]));
assert.equal(getOrCreateClientQuoteId(), "abcde");
assert.deepEqual(getPendingClientQuoteIds(), ["keep"]);
ok("a 5-char current id is trusted and is not appended to pending");

store.setItem(KEY_CURRENT, "abcde");
store.setItem(KEY_LIST, JSON.stringify(["abcde", "abcde"]));
assert.equal(getOrCreateClientQuoteId(), "abcde");
assert.deepEqual(getPendingClientQuoteIds(), ["abcde", "abcde"]);
ok("duplicate pending ids are not collapsed");

store.setItem(KEY_LIST, JSON.stringify([1, "keep", null, { a: 1 }]));
store.setItem(KEY_CURRENT, "nope!");
assert.equal(getOrCreateClientQuoteId(), "nope!");
assert.deepEqual(getPendingClientQuoteIds(), ["keep"]);
const pending = getPendingClientQuoteIds();
pending.push("evil");
assert.deepEqual(getPendingClientQuoteIds(), ["keep"]);
ok("non-strings are dropped and the returned list is a copy");

store.setItem(KEY_CURRENT, "");
store.setItem(KEY_LIST, "{not:1}");
const afterCorrupt = getOrCreateClientQuoteId();
assert.equal(afterCorrupt.startsWith("cq_"), true);
assert.deepEqual(getPendingClientQuoteIds(), [afterCorrupt]);
ok("corrupt pending JSON resets to the new id");

const quotaStore = useStorage(createMemoryStorage());
quotaStore.throwOn(KEY_LIST);
const quotaId = getOrCreateClientQuoteId();
assert.equal(quotaId.startsWith("cq_"), true);
assert.equal(quotaStore.getItem(KEY_CURRENT), quotaId);
assert.deepEqual(getPendingClientQuoteIds(), []);
ok("a pending-list write failure still returns the current id");

const throwCurrent = useStorage(createMemoryStorage());
throwCurrent.throwOn(KEY_CURRENT);
assert.throws(() => getOrCreateClientQuoteId(), /quota/);
ok("a current-id write failure is not swallowed");

delete globalThis.window;
const looseA = getOrCreateClientQuoteId();
const looseB = getOrCreateClientQuoteId();
assert.notEqual(looseA, looseB);
assert.equal(looseA.startsWith("cq_"), true);
assert.deepEqual(getPendingClientQuoteIds(), []);
clearPending();
assert.deepEqual(getPendingClientQuoteIds(), []);
ok("without storage each call is a new id and pending stays empty");

console.log(`clientQuoteIdGates: ${passed} passed`);
