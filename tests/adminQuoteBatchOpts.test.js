// Offline. node tests/adminQuoteBatchOpts.test.js
import assert from "node:assert/strict";
import { DEFAULT_BATCH_OPTS, loadBatchOpts } from "../src/hooks/admin-cotizaciones/useBatchOpts.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
  };
}

check("missing storage value returns the defaults", () => {
  assert.deepEqual(loadBatchOpts(memoryStorage()), DEFAULT_BATCH_OPTS);
});

check("explicit false flags stay false and a missing flag stays on", () => {
  const storage = memoryStorage({
    bmc_admin_quote_batch_opts: JSON.stringify({ force: 1, syncToCrm: false }),
  });
  assert.deepEqual(loadBatchOpts(storage), {
    force: true,
    syncToCrm: false,
    createCrmRows: true,
    syncQuoteLink: true,
  });
});

check("invalid JSON falls back to the defaults", () => {
  const storage = memoryStorage({ bmc_admin_quote_batch_opts: "{" });
  assert.deepEqual(loadBatchOpts(storage), DEFAULT_BATCH_OPTS);
});

console.log(`\nadminQuoteBatchOpts: ${passed} passed`);
