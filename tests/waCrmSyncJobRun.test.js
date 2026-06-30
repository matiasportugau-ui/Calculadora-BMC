// runWaCrmSyncJob — insert-once existence gate, create path, and parse retry/skip.
// Offline: fake pool (no .connect → advisory lock bypassed), injected Sheets, fetch stub.
import { runWaCrmSyncJob } from "../server/lib/wa/waCrmSyncJob.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

const CHAT = "59891234567";
const msgPool = {
  query: async () => ({
    rows: [
      { sender: "customer", body: "Hola, quiero cotizar", created_at: "2026-06-30T01:00:00Z", channel_conversation_id: CHAT, contact_name: "Ana" },
    ],
  }),
};
const config = { port: 3001, bmcSheetId: "sheet1", googleApplicationCredentials: "/fake/creds.json" };

// Sheets stub parameterized by what CRM_Operativo!C4:D500 returns.
function fakeSheets(crmCD) {
  const updates = [];
  return {
    updates,
    spreadsheets: {
      values: {
        get: async ({ range }) => {
          if (range.includes("Form responses")) return { data: { values: [] } };
          if (range.includes("C4:D500")) return { data: { values: crmCD } };
          if (range.includes("C4:C500")) return { data: { values: crmCD.map((r) => [r[0]]) } };
          return { data: { values: [] } };
        },
        update: async (req) => { updates.push(req.range); return {}; },
      },
    },
  };
}

// ── Existing row for this phone → skip parse + skip all writes (no clobber) ──
let fetched = false;
const existingSheets = fakeSheets([["Ana", CHAT]]);
const r1 = await runWaCrmSyncJob({
  pool: msgPool, jobRow: { conversation_id: "c1" }, config, logger: null,
  sheets: existingSheets,
  fetchImpl: async () => { fetched = true; return { ok: true, json: async () => ({ ok: true, data: {} }) }; },
});
assert("existing row → skipped crm_row_exists", r1.skipped === true && r1.reason === "crm_row_exists");
assert("existing row → row number returned", r1.crm_row === 4);
assert("existing row → parse NOT called (no cost, no clobber)", fetched === false);
assert("existing row → no Sheets writes", existingSheets.updates.length === 0);

// ── No existing row → parse → create ──
const createSheets = fakeSheets([["", ""]]); // empty row 4 → create there
const r2 = await runWaCrmSyncJob({
  pool: msgPool, jobRow: { conversation_id: "c1" }, config, logger: null,
  sheets: createSheets,
  fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true, data: { cliente: "Ana", telefono: CHAT } }) }),
});
assert("new lead → created (not skipped)", r2.skipped === false);
assert("new lead → crm_row 4", r2.crm_row === 4);
assert("new lead → Sheets writes happened", createSheets.updates.length > 0);

// ── Transient parse 503 (no existing row) → throws so the job retries ──
let threw = false;
try {
  await runWaCrmSyncJob({
    pool: msgPool, jobRow: { conversation_id: "c1" }, config, logger: null,
    sheets: fakeSheets([["", ""]]),
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });
} catch (e) { threw = /parse_conversation_http_503/.test(e.message); }
assert("503 parse → throws (retryable)", threw);

// ── 200 unparseable → skip cleanly ──
const r4 = await runWaCrmSyncJob({
  pool: msgPool, jobRow: { conversation_id: "c1" }, config, logger: null,
  sheets: fakeSheets([["", ""]]),
  fetchImpl: async () => ({ ok: true, json: async () => ({ ok: false }) }),
});
assert("200 unparseable → skipped", r4.skipped === true && r4.reason === "parse_unparseable");

// ── empty conversation → skipped before any Sheets/fetch ──
const r5 = await runWaCrmSyncJob({
  pool: { query: async () => ({ rows: [] }) },
  jobRow: { conversation_id: "c1" }, config, logger: null,
  sheets: fakeSheets([["", ""]]),
  fetchImpl: async () => { throw new Error("should not fetch"); },
});
assert("no messages → skipped", r5.skipped === true && r5.reason === "no_messages");

console.log(`\nwaCrmSyncJobRun: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
