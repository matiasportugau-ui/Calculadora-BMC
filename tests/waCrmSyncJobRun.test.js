// runWaCrmSyncJob — transient vs unparseable parse handling (offline, no Sheets).
// Sheets is never reached: 503 throws first, and the unparseable case returns before
// writeWaCrmIngest. Pool + fetch are stubbed.
import { runWaCrmSyncJob } from "../server/lib/wa/waCrmSyncJob.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

const pool = {
  query: async () => ({
    rows: [
      { sender: "customer", body: "Hola, quiero cotizar", created_at: "2026-06-30T01:00:00Z", channel_conversation_id: "598111", contact_name: "Ana" },
    ],
  }),
};
const config = { port: 3001, bmcSheetId: "", googleApplicationCredentials: "" };

// Transient HTTP failure (503) → must THROW so the worker retries.
let threw = false;
try {
  await runWaCrmSyncJob({
    pool, jobRow: { conversation_id: "c1" }, config, logger: null,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
} catch (e) {
  threw = /parse_conversation_http_503/.test(e.message);
}
assert("503 parse → throws (retryable)", threw);

// 200 but unparseable → skip cleanly (no throw, no retry).
const r = await runWaCrmSyncJob({
  pool, jobRow: { conversation_id: "c1" }, config, logger: null,
  fetchImpl: async () => ({ ok: true, json: async () => ({ ok: false }) }),
});
assert("200 unparseable → skipped, not thrown", r.skipped === true && r.reason === "parse_unparseable");

// empty conversation → skipped no_messages
const r2 = await runWaCrmSyncJob({
  pool: { query: async () => ({ rows: [] }) },
  jobRow: { conversation_id: "c1" }, config, logger: null,
  fetchImpl: async () => { throw new Error("should not fetch"); },
});
assert("no messages → skipped before fetch", r2.skipped === true && r2.reason === "no_messages");

console.log(`\nwaCrmSyncJobRun: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
