// WAVE 3 hardening fold-in — offline (no DB, no network)
// node tests/omniHardening.test.js
import {
  enqueueAiJob,
  runAiJobById,
  ALLOWED_AI_JOB_TYPES,
} from "../server/lib/omni/orchestrator/aiWorker.js";
import { getActivePromptContract } from "../server/lib/omni/orchestrator/aiRegistry.js";
import { ALLOWED_CONVERSATION_STATUSES } from "../server/lib/omni/orchestrator/automationEngine.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

/**
 * Minimal mock pg pool: dispatches query() by first matching SQL substring.
 * Records every call in `.calls` for SQL assertions.
 */
function makePool(handlers) {
  const calls = [];
  async function query(sql, params) {
    calls.push({ sql, params });
    for (const [needle, resp] of handlers) {
      if (sql.includes(needle)) return typeof resp === "function" ? resp(sql, params) : resp;
    }
    return { rows: [] };
  }
  return { calls, query, async connect() { return { query, release() {} }; } };
}

const aiJobsWrites = (pool) =>
  pool.calls.filter((c) => c.sql.includes("omni_ai_jobs") && c.sql.trim().startsWith("UPDATE"));

// ── P2: job_type allowlist ────────────────────────────────────────────────
assert(
  "ALLOWED_AI_JOB_TYPES matches DB constraint set",
  JSON.stringify([...ALLOWED_AI_JOB_TYPES].sort()) ===
    JSON.stringify(["assist", "classify", "embed", "extract_deal", "suggest", "wa_crm_sync"]),
);

await (async () => {
  let threw = false;
  try {
    await enqueueAiJob({ query() { throw new Error("should not query"); } }, { job_type: "evil" });
  } catch (e) {
    threw = e.message === "invalid_job_type";
  }
  assert("enqueueAiJob rejects unknown job_type before touching DB", threw);
})();

// ── P1: attempts incremented exactly once per claim ───────────────────────
const jobRow = {
  id: "j1",
  status: "pending",
  attempts: 0,
  job_type: "classify",
  message_id: "m1",
  conversation_id: "c1",
  channel: "wa",
};

// Scenario A — success path: claim transition must increment attempts.
await (async () => {
  const pool = makePool([
    ["SUM(cost_usd)", { rows: [{ total: 0 }] }],
    ["SELECT m.body", { rows: [{ body: "Necesito cotización techo", sender: "customer", channel: "wa" }] }],
    ["INSERT INTO omni_ai_jobs", { rows: [{ id: "j2" }] }],
    ["SELECT * FROM omni_ai_jobs WHERE id", { rows: [jobRow] }],
  ]);
  await runAiJobById(pool, "j1");
  const writes = aiJobsWrites(pool);
  const claim = writes.find((c) => c.sql.includes("status = 'running'"));
  const incrementing = writes.filter((c) => c.sql.includes("attempts = attempts + 1"));
  assert("claim transition increments attempts", Boolean(claim && claim.sql.includes("attempts = attempts + 1")));
  assert("exactly one attempts increment on success path", incrementing.length === 1);
})();

// Scenario B — failure path (message_not_found): markJobFailed must NOT re-increment.
await (async () => {
  const pool = makePool([
    ["SUM(cost_usd)", { rows: [{ total: 0 }] }],
    ["SELECT m.body", { rows: [] }], // → markJobFailed("message_not_found")
    ["SELECT * FROM omni_ai_jobs WHERE id", { rows: [jobRow] }],
  ]);
  await runAiJobById(pool, "j1");
  const writes = aiJobsWrites(pool);
  const failUpdate = writes.find((c) => c.sql.includes("WHEN attempts >= 2"));
  const incrementing = writes.filter((c) => c.sql.includes("attempts = attempts + 1"));
  assert("markJobFailed does not increment attempts", Boolean(failUpdate) && !failUpdate.sql.includes("attempts = attempts + 1"));
  assert("exactly one attempts increment on failure path", incrementing.length === 1);
})();

// ── P3: system_prompt not exposed by the HTTP prompt contract ──────────────
await (async () => {
  const pool = makePool([
    ["omni_prompt_registry", { rows: [{ version: 3, system_prompt: "INTERNAL SECRET PROMPT", user_template: "{{x}}" }] }],
    ["omni_model_registry", { rows: [{ version: 1, provider: "anthropic", model_id: "claude", max_tokens: 1024 }] }],
  ]);
  const contract = await getActivePromptContract(pool, "classify", "wa");
  assert("getActivePromptContract omits system_prompt key", !("system_prompt" in contract));
  assert("getActivePromptContract still reports versions", contract.prompt_version === 3 && contract.model_version === 1);
})();

// ── P5: conversation status whitelist ─────────────────────────────────────
assert("status whitelist includes seed default 'open'", ALLOWED_CONVERSATION_STATUSES.includes("open"));
assert("status whitelist excludes arbitrary values", !ALLOWED_CONVERSATION_STATUSES.includes("pwned"));

console.log(`\nomniHardening (offline): ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
