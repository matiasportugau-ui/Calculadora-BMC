// tests/omniSnoozeWorker.test.js — standalone (no real DB) unit test for the
// snooze auto-reopen worker. Run: `node tests/omniSnoozeWorker.test.js`.
import assert from "node:assert/strict";
import { startOmniSnoozeWorker } from "../server/lib/omni/snoozeWorker.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`  ok ${name}`);
  });
}

const tick = () => new Promise((r) => setTimeout(r, 15));

await check("null pool → safe no-op stop fn", () => {
  const stop = startOmniSnoozeWorker({ pool: null });
  assert.equal(typeof stop, "function");
  stop(); // must not throw
});

await check("boot tick issues the reopen UPDATE with the right guards", async () => {
  const queries = [];
  const pool = {
    query: async (sql) => {
      queries.push(sql);
      return { rowCount: 0 };
    },
  };
  const stop = startOmniSnoozeWorker({ pool, intervalMs: 1_000_000 });
  await tick();
  stop();
  assert.ok(queries.length >= 1, "boot tick ran a query");
  const sql = queries[0];
  assert.match(sql, /UPDATE\s+omni_conversations/i);
  assert.match(sql, /status\s*=\s*'open'/i);
  assert.match(sql, /snoozed_until\s*=\s*NULL/i);
  assert.match(sql, /status\s*=\s*'snoozed'/i);
  assert.match(sql, /snoozed_until\s*<=\s*now\(\)/i);
});

await check("a failing tick is swallowed (loop survives DB errors)", async () => {
  const pool = {
    query: async () => {
      throw new Error("boom");
    },
  };
  const stop = startOmniSnoozeWorker({ pool, intervalMs: 1_000_000 });
  await tick(); // must not reject/throw out of the worker
  stop();
});

await check("stop() prevents further ticks", async () => {
  let calls = 0;
  const pool = {
    query: async () => {
      calls += 1;
      return { rowCount: 0 };
    },
  };
  const stop = startOmniSnoozeWorker({ pool, intervalMs: 5 });
  await tick();
  stop();
  const after = calls;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(calls, after, "no ticks after stop()");
});

console.log(`\nomni snoozeWorker: ${passed} checks passed`);
