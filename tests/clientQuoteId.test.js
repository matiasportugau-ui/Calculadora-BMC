/**
 * Browser client_quote_id — anonymous quote claim key.
 * Run: node tests/clientQuoteId.test.js
 *
 * Pins getOrCreate / rotate / pending list / clearPending. A regression here
 * can merge another browser's drafts into the logged-in account or drop the
 * claim list so /api/me/quotes/claim is a no-op.
 */
import assert from "node:assert/strict";

function installMemoryStorage() {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  globalThis.window = { localStorage: storage };
  globalThis.localStorage = storage;
  return store;
}

installMemoryStorage();

const {
  getOrCreateClientQuoteId,
  rotateClientQuoteId,
  getPendingClientQuoteIds,
  clearPending,
  __resetClientQuoteIdForTests,
} = await import("../src/utils/clientQuoteId.js");

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function reset() {
  __resetClientQuoteIdForTests();
}

console.log("\n— getOrCreate + persist");
reset();
const first = getOrCreateClientQuoteId();
check(/^cq_/.test(first) && first.length > 8, "id has cq_ prefix + entropy");
check(
  /^cq_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first),
  "Node path uses crypto.randomUUID (cq_<uuid>)",
);
check(getOrCreateClientQuoteId() === first, "second call returns the same current id");
check(getPendingClientQuoteIds().includes(first), "current id is on the pending claim list");

console.log("\n— rotate keeps both ids for claim");
const second = rotateClientQuoteId();
check(second !== first, "rotate issues a new id");
check(getOrCreateClientQuoteId() === second, "current pointer follows rotate");
const pending = getPendingClientQuoteIds();
check(pending.includes(first) && pending.includes(second), "pending list keeps pre-rotate ids");
check(pending.length === 2, "pending is deduped (exactly the two ids)");

console.log("\n— clearPending keeps current row key");
clearPending();
check(getPendingClientQuoteIds().length === 0, "clearPending drops the claim list");
check(getOrCreateClientQuoteId() === second, "current id survives clear (edits stay on same row)");

console.log("\n— short / corrupt storage");
reset();
window.localStorage.setItem("bmc.client_quote_id", "cq_");
const regenerated = getOrCreateClientQuoteId();
check(regenerated !== "cq_" && regenerated.length > 8, "current id shorter than 5 chars is regenerated");

reset();
window.localStorage.setItem("bmc.client_quote_ids", "{not-json");
check(getPendingClientQuoteIds().length === 0, "corrupt pending JSON → empty list");

reset();
window.localStorage.setItem("bmc.client_quote_ids", JSON.stringify(["cq_ok", 12, null, "cq_two"]));
check(
  JSON.stringify(getPendingClientQuoteIds()) === JSON.stringify(["cq_ok", "cq_two"]),
  "non-string pending entries are dropped",
);

console.log("\n— no localStorage: generate but do not invent a claim list");
const savedWindow = globalThis.window;
globalThis.window = undefined;
const ephemeral = getOrCreateClientQuoteId();
check(/^cq_/.test(ephemeral), "no-store path still returns an id");
check(getPendingClientQuoteIds().length === 0, "no-store path cannot persist pending ids");
globalThis.window = savedWindow;

console.log(`\nclientQuoteId: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
