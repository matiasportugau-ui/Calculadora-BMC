#!/usr/bin/env node
/**
 * Omni local E2E harness (Phase 1) — side-effect-safe verification of the
 * three WAVE 4 staging gates against a THROWAWAY Postgres, with NO AI provider,
 * NO channel outbound, NO Sheets, NO prod contact.
 *
 *   HITL  — listSuggestions → resolveSuggestion(accept/reject) (+ route's recordOmniPromptEval)
 *   H4    — getPromptEvalStats reflects the accept/reject
 *   F3    — scripts/omni-reconcile-deals.mjs --dry-run computes drift + ok(<10) gate
 *
 * Usage: DATABASE_URL=postgres://…/omni_e2e node scripts/omni-local-e2e.mjs
 * Exercises the REAL omni functions (no HTTP/auth) so it runs regardless of the
 * identity schema. The route handlers are thin wrappers over these calls.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { listSuggestions, resolveSuggestion } from "../server/lib/omni/orchestrator/suggestions.js";
import { recordOmniPromptEval, getPromptEvalStats } from "../server/lib/omni/knowledge/evalFeedback.js";
import { enqueueAiJob, enqueueIngestAiJobs, ALLOWED_AI_JOB_TYPES } from "../server/lib/omni/orchestrator/aiWorker.js";
import { config } from "../server/config.js";

// This harness TRUNCATEs omni tables, so it must ONLY ever touch a throwaway DB.
// Three guards make it impossible to point at a real database:
//   1) reads a dedicated var (OMNI_E2E_DATABASE_URL), never the shared DATABASE_URL;
//   2) host must be local AND db name must match /e2e/;
//   3) must differ from process.env.DATABASE_URL.
// Use `npm run omni:local-e2e` (scripts/omni-local-e2e.sh) which provisions one.
const DB = process.env.OMNI_E2E_DATABASE_URL;
if (!DB) {
  console.error("OMNI_E2E_DATABASE_URL required — run `npm run omni:local-e2e` (self-provisions a throwaway DB).");
  process.exit(2);
}
try {
  const u = new URL(DB);
  const dbName = u.pathname.replace(/^\//, "");
  if (!/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) {
    console.error(`refusing: non-local DB host ${u.hostname}`);
    process.exit(2);
  }
  if (!/e2e/i.test(dbName)) {
    console.error(`refusing: DB name '${dbName}' is not a throwaway (must contain 'e2e')`);
    process.exit(2);
  }
  if (DB === process.env.DATABASE_URL) {
    console.error("refusing: OMNI_E2E_DATABASE_URL must differ from DATABASE_URL");
    process.exit(2);
  }
} catch (e) {
  console.error("OMNI_E2E_DATABASE_URL is not a valid URL:", e.message);
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: DB });

let passed = 0;
let failed = 0;
const checks = [];
function assert(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
  checks.push({ name, ok: !!cond, detail: detail || null });
}

// Mirror the accept/reject route handler exactly (suggestions.js + evalFeedback.js).
// `question` is intentionally omitted so saveFeedback() (a file write) never fires.
async function hitlResolve(id, action) {
  const result = await resolveSuggestion(pool, id, action, { actor: "e2e@local" });
  if (!result.ok) return result;
  const meta = result.suggestion.metadata || {};
  await recordOmniPromptEval(pool, {
    task_key: "suggest",
    prompt_version: meta.prompt_version ?? 1,
    suggestion_id: result.suggestion.id,
    rating: action === "accept" ? "accepted" : "rejected",
    channel: result.suggestion.channel,
    generated_text: result.suggestion.body,
    conversation_id: result.suggestion.conversation_id,
    metadata: { actor: result.actor },
  });
  return result;
}

async function main() {
  // Idempotent clean slate
  await pool.query(
    `TRUNCATE omni_prompt_eval, omni_suggestions, omni_ai_jobs, omni_deals,
              omni_messages, omni_conversations, omni_contacts RESTART IDENTITY CASCADE`,
  );

  // ── Seed: registry + contact → conversation → customer message ───────────
  await pool.query(
    `INSERT INTO omni_prompt_registry (task_key, channel, version, system_prompt, enabled)
     VALUES ('suggest','wa',1,'E2E system prompt',true)
     ON CONFLICT (task_key, channel, version) DO NOTHING`,
  );
  const { rows: [contact] } = await pool.query(
    `INSERT INTO omni_contacts (integration_uuid, wa_phone, name)
     VALUES ('e2e-uuid-1','+59899000001','E2E Cliente') RETURNING id`,
  );
  const { rows: [conv] } = await pool.query(
    `INSERT INTO omni_conversations (contact_id, channel, channel_conversation_id, status)
     VALUES ($1,'wa','wa-conv-1','open') RETURNING id`,
    [contact.id],
  );
  const { rows: [msg] } = await pool.query(
    `INSERT INTO omni_messages (conversation_id, sender, body)
     VALUES ($1,'customer','Necesito cotización techo 100m2') RETURNING id`,
    [conv.id],
  );

  // Two suggest jobs + two pending suggestions
  const mkJob = async () =>
    (await pool.query(
      `INSERT INTO omni_ai_jobs (job_type, message_id, conversation_id, channel, status, prompt_version, approval_state)
       VALUES ('suggest',$1,$2,'wa','completed',1,'pending') RETURNING id`,
      [msg.id, conv.id],
    )).rows[0].id;
  const jobA = await mkJob();
  const jobB = await mkJob();
  const mkSuggestion = async (jobId, body) =>
    (await pool.query(
      `INSERT INTO omni_suggestions (message_id, conversation_id, job_id, channel, body, metadata, approval_state)
       VALUES ($1,$2,$3,'wa',$4,'{"prompt_version":1}'::jsonb,'pending') RETURNING id`,
      [msg.id, conv.id, jobId, body],
    )).rows[0].id;
  const sA = await mkSuggestion(jobA, "Sugerencia A — cotización de techo");
  const sB = await mkSuggestion(jobB, "Sugerencia B — alternativa");

  // ── HITL ─────────────────────────────────────────────────────────────────
  console.log("\n[HITL] accept/reject E2E");
  const pending = await listSuggestions(pool, {});
  assert("listSuggestions returns 2 pending", pending.length === 2, `got ${pending.length}`);
  assert("suggestion joins customer_message", String(pending[0]?.customer_message || "").includes("cotización"));

  const rA = await hitlResolve(sA, "accept");
  assert("accept → approval_state accepted", rA.ok && rA.suggestion.approval_state === "accepted");
  const jobAState = (await pool.query(`SELECT approval_state FROM omni_ai_jobs WHERE id=$1`, [jobA])).rows[0];
  assert("linked ai_job marked accepted", jobAState?.approval_state === "accepted", JSON.stringify(jobAState));

  const rB = await hitlResolve(sB, "reject");
  assert("reject → approval_state rejected", rB.ok && rB.suggestion.approval_state === "rejected");

  const rA2 = await resolveSuggestion(pool, sA, "accept", {});
  assert("re-resolving a resolved suggestion is refused", rA2.ok === false, JSON.stringify(rA2));

  const afterPending = await listSuggestions(pool, {});
  assert("0 pending after both resolved", afterPending.length === 0, `got ${afterPending.length}`);

  // ── H4 eval ────────────────────────────────────────────────────────────────
  console.log("\n[H4] eval report reflects feedback");
  const stats = await getPromptEvalStats(pool, "suggest");
  const byRating = Object.fromEntries(stats.map((r) => [r.rating, r.count]));
  assert("H4 eval: accepted = 1", byRating.accepted === 1, JSON.stringify(stats));
  assert("H4 eval: rejected = 1", byRating.rejected === 1, JSON.stringify(stats));

  // ── F3 reconcile (drift + <10 gate) ─────────────────────────────────────────
  console.log("\n[F3] dual-write reconcile drift gate");
  await pool.query(
    `INSERT INTO omni_deals (contact_id, title, value_usd, stage, source_channel, properties)
     VALUES ($1,'Deal sin CRM',1000,'qualified','wa','{}'::jsonb)`,
    [contact.id],
  );
  await pool.query(
    `INSERT INTO omni_deals (contact_id, title, value_usd, stage, source_channel, properties)
     VALUES ($1,'Deal con CRM ref',2000,'proposal','wa','{"crm_row_id":"CRM-999"}'::jsonb)`,
    [contact.id],
  );
  const recon = spawnSync("node", ["scripts/omni-reconcile-deals.mjs", "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: DB, BMC_SHEET_ID: "" },
  });
  let reconReport = null;
  try {
    // The reconcile script prints pretty JSON ("{\n  ...\n}"); dotenv tips are
    // single-line and may contain stray braces, so match the multi-line block.
    const m = recon.stdout.match(/\{\n[\s\S]*\n\}/);
    reconReport = JSON.parse(m[0]);
  } catch (e) {
    assert("F3 reconcile produced parseable JSON", false, `${e.message}; stdout=${recon.stdout.slice(0, 200)}`);
  }
  if (reconReport) {
    assert("F3 deals_checked = 2", reconReport.deals_checked === 2, JSON.stringify(reconReport));
    assert("F3 linked_deals = 1 (only crm_row_id deal)", reconReport.linked_deals === 1);
    assert("F3 drift_count = 1 (crm_row_missing, no Sheets)", reconReport.drift_count === 1);
    assert("F3 ok gate true (drift < 10)", reconReport.ok === true);
    assert("F3 exit code 0 matches ok", recon.status === 0, `exit=${recon.status}`);
  }

  // ── WA-CANONICAL (migration 011 + wa_crm_sync coalescing) ───────────────────
  // The DB-backed half of the OMNI_WA_CANONICAL flip: the partial unique index +
  // ON CONFLICT coalescing + widened CHECK can only be verified against real
  // Postgres (offline fake-pool tests can't). Reuses the seeded contact/conv/msg.
  console.log("\n[WA-CANONICAL] migration 011 + wa_crm_sync coalescing");

  assert("ALLOWED_AI_JOB_TYPES includes wa_crm_sync", ALLOWED_AI_JOB_TYPES.includes("wa_crm_sync"));

  const { rows: idxRows } = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE indexname = 'omni_ai_jobs_wa_crm_sync_pending_dedup'`,
  );
  assert("migration 011: partial coalescing index exists", idxRows.length === 1);

  // CHECK constraint widened to accept wa_crm_sync, still rejects bogus types.
  let acceptOk = false;
  try {
    await pool.query(
      `INSERT INTO omni_ai_jobs (job_type, message_id, conversation_id, channel, status)
       VALUES ('wa_crm_sync',$1,$2,'wa','completed')`,
      [msg.id, conv.id],
    );
    acceptOk = true;
  } catch (e) {
    acceptOk = false;
    console.log(`    (wa_crm_sync insert failed: ${e.message})`);
  }
  assert("CHECK accepts wa_crm_sync (completed row)", acceptOk);

  let bogusRejected = false;
  try {
    await pool.query(
      `INSERT INTO omni_ai_jobs (job_type, message_id, conversation_id, channel, status)
       VALUES ('totally_bogus',$1,$2,'wa','pending')`,
      [msg.id, conv.id],
    );
  } catch {
    bogusRejected = true;
  }
  assert("CHECK rejects unknown job_type", bogusRejected);

  // Coalescing: two pending wa_crm_sync for the SAME conversation collapse to one.
  const wa1 = await enqueueAiJob(
    pool,
    { job_type: "wa_crm_sync", message_id: msg.id, conversation_id: conv.id, channel: "wa" },
    { onConflictDoNothing: true },
  );
  const wa2 = await enqueueAiJob(
    pool,
    { job_type: "wa_crm_sync", message_id: msg.id, conversation_id: conv.id, channel: "wa" },
    { onConflictDoNothing: true },
  );
  assert("1st wa_crm_sync enqueues (non-null id)", !!wa1);
  assert("2nd wa_crm_sync coalesces (null id)", wa2 === null);
  const { rows: pendCnt } = await pool.query(
    `SELECT count(*)::int AS n FROM omni_ai_jobs
      WHERE conversation_id=$1 AND job_type='wa_crm_sync' AND status='pending'`,
    [conv.id],
  );
  assert("exactly one pending wa_crm_sync per conversation", pendCnt[0].n === 1, `got ${pendCnt[0].n}`);

  // The index is scoped to wa_crm_sync: classify/suggest are NOT coalesced.
  const c1 = await enqueueAiJob(pool, { job_type: "classify", message_id: msg.id, conversation_id: conv.id, channel: "wa" });
  const c2 = await enqueueAiJob(pool, { job_type: "classify", message_id: msg.id, conversation_id: conv.id, channel: "wa" });
  assert("classify NOT coalesced (two distinct ids)", !!c1 && !!c2 && c1 !== c2);

  // Integration: enqueueIngestAiJobs enqueues a wa_crm_sync when the flag is ON.
  // (Deterministic only if the harness env set the flags — see omni-local-e2e.sh.)
  if (config.omniWaCanonical && config.omniAiOrchestratorEnabled) {
    const { rows: [conv2] } = await pool.query(
      `INSERT INTO omni_conversations (contact_id, channel, channel_conversation_id, status)
       VALUES ($1,'wa','wa-conv-2','open') RETURNING id`,
      [contact.id],
    );
    const { rows: [msg2] } = await pool.query(
      `INSERT INTO omni_messages (conversation_id, sender, body)
       VALUES ($1,'customer','Otra consulta') RETURNING id`,
      [conv2.id],
    );
    await enqueueIngestAiJobs(pool, {
      duplicate: false,
      message: { sender: "customer" },
      channel: "wa",
      message_id: msg2.id,
      conversation_id: conv2.id,
    });
    const { rows: ing } = await pool.query(
      `SELECT job_type FROM omni_ai_jobs WHERE conversation_id=$1`,
      [conv2.id],
    );
    const types = ing.map((r) => r.job_type);
    assert("enqueueIngestAiJobs(wa,ON) → classify+suggest+wa_crm_sync",
      types.includes("classify") && types.includes("suggest") && types.includes("wa_crm_sync"),
      JSON.stringify(types));
  } else {
    console.log("  ⏭ enqueueIngestAiJobs integration skipped (OMNI_WA_CANONICAL/ORCHESTRATOR not set in harness env)");
  }

  // ── Evidence artifact ────────────────────────────────────────────────────────
  const report = {
    at: new Date().toISOString(),
    db_host: new URL(DB).hostname,
    tier: "A (function-level, no HTTP/auth)",
    passed,
    failed,
    checks,
    f3_reconcile: reconReport,
    note: "F3 with no Sheets creds reports crm_row_missing for linked deals — proves the script runs and the <10 gate works; real drift requires staging Sheets.",
  };
  const outDir = path.resolve(".runtime");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = report.at.replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `omni-local-e2e-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`\nomni-local-e2e: ${passed} passed, ${failed} failed`);
  console.log(`evidence: ${outFile}`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error("E2E harness error:", e);
  try { await pool.end(); } catch {}
  process.exit(1);
});
