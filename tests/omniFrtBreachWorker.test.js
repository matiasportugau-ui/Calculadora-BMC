// tests/omniFrtBreachWorker.test.js — standalone (no real DB) unit test for the
// FRT breach historian worker. Run: `node tests/omniFrtBreachWorker.test.js`.
import assert from "node:assert/strict";
import { startOmniFrtBreachWorker } from "../server/lib/omni/orchestrator/frtBreachWorker.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`  ok ${name}`);
  });
}

const tick = () => new Promise((r) => setTimeout(r, 15));
const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

await check("null pool → safe no-op stop fn", () => {
  const stop = startOmniFrtBreachWorker({ pool: null });
  assert.equal(typeof stop, "function");
  stop(); // must not throw
});

await check("boot tick: closes resolved breaches first, then scans for new ones", async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/^UPDATE\s+omni_frt_breaches/i.test(sql)) return { rowCount: 1 };
      if (/^SELECT/i.test(sql)) return { rows: [] };
      return { rowCount: 0 };
    },
  };
  const stop = startOmniFrtBreachWorker({ pool, intervalMs: 1_000_000 });
  await tick();
  stop();
  assert.ok(queries.length >= 2, "boot tick ran the close + select queries");
  assert.match(queries[0].sql, /UPDATE\s+omni_frt_breaches/i);
  assert.match(queries[0].sql, /resolved_at\s*=\s*c\.first_agent_reply_at/i);
  assert.match(queries[1].sql, /SELECT/i);
  assert.match(queries[1].sql, /omni_conversations/i);
  assert.match(queries[1].sql, /first_agent_reply_at\s+IS\s+NULL/i);
});

await check("inserts a breach only for conversations past their channel SLA", async () => {
  const inserted = [];
  const pool = {
    query: async (sql, params) => {
      if (/^UPDATE\s+omni_frt_breaches/i.test(sql)) return { rowCount: 0 };
      if (/^SELECT/i.test(sql)) {
        return {
          rows: [
            // WA, 1h awaiting, SLA 0.5h → breached
            { id: "conv-wa-breach", channel: "wa", created_at: hoursAgo(1), first_agent_reply_at: null, last_message_at: hoursAgo(1) },
            // email, 1h awaiting, SLA 2h → not breached
            { id: "conv-email-ok", channel: "email", created_at: hoursAgo(1), first_agent_reply_at: null, last_message_at: hoursAgo(1) },
          ],
        };
      }
      if (/^INSERT\s+INTO\s+omni_frt_breaches/i.test(sql)) {
        inserted.push(params);
        return { rowCount: 1 };
      }
      return { rowCount: 0 };
    },
  };
  const stop = startOmniFrtBreachWorker({ pool, intervalMs: 1_000_000 });
  await tick();
  stop();
  assert.equal(inserted.length, 1, "only the WA conversation breached");
  assert.equal(inserted[0][0], "conv-wa-breach");
  assert.equal(inserted[0][1], "wa");
  assert.equal(inserted[0][2], 0.5, "sla_target_hours matches the WA channel SLA");
});

await check("table-missing (42P01) degrades without throwing", async () => {
  const pool = {
    query: async () => {
      const e = new Error('relation "omni_frt_breaches" does not exist');
      e.code = "42P01";
      throw e;
    },
  };
  const stop = startOmniFrtBreachWorker({ pool, intervalMs: 1_000_000 });
  await tick(); // must not reject/throw out of the worker
  stop();
});

await check("a failing tick is swallowed (loop survives DB errors)", async () => {
  const pool = {
    query: async () => {
      throw new Error("boom");
    },
  };
  const stop = startOmniFrtBreachWorker({ pool, intervalMs: 1_000_000 });
  await tick();
  stop();
});

await check("stop() prevents further ticks", async () => {
  let calls = 0;
  const pool = {
    query: async (sql) => {
      calls += 1;
      if (/^SELECT/i.test(sql)) return { rows: [] };
      return { rowCount: 0 };
    },
  };
  const stop = startOmniFrtBreachWorker({ pool, intervalMs: 5 });
  await tick();
  stop();
  const after = calls;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(calls, after, "no ticks after stop()");
});

console.log(`\nomni frtBreachWorker: ${passed} checks passed`);
