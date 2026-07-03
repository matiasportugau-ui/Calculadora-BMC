// Regression guard for the production WA canonical cutover workflow.
//
// The workflow can mutate prod state (repo Variables, Cloud Run env, prod DB
// migrations), so keep static invariants around the critical safety rails.
// Run: node tests/waCanonicalCutoverWorkflow.test.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const workflow = fs.readFileSync(
  path.join(REPO_ROOT, ".github/workflows/wa-canonical-cutover.yml"),
  "utf8",
);

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.error(`  ❌ ${name}`);
    failed += 1;
  }
}

function section(startMarker, endMarker) {
  const start = workflow.indexOf(startMarker);
  const end = endMarker ? workflow.indexOf(endMarker, start + startMarker.length) : workflow.length;
  if (start === -1 || end === -1) return "";
  return workflow.slice(start, end);
}

const migrateJob = section("  migrate:", "\n  flip:");
const flipJob = section("  flip:", "\n  soak:");
const soakJob = section("  soak:");

assert("migrate job exists", migrateJob.length > 0);
assert("flip job exists", flipJob.length > 0);
assert("soak job exists", soakJob.length > 0);

assert(
  "migrate checkout is pinned to main before touching prod DATABASE_URL",
  /uses:\s+actions\/checkout@v4[\s\S]*?with:\s*\n\s*ref:\s+main/.test(migrateJob),
);

assert(
  "soak checkout is pinned to main before reading prod DATABASE_URL",
  /uses:\s+actions\/checkout@v4[\s\S]*?with:\s*\n\s*ref:\s+main/.test(soakJob),
);

for (const migration of [
  "011_wa_crm_sync_job.sql",
  "012_omni_ai_jobs_run_after.sql",
  "014_ai_job_type_union.sql",
]) {
  assert(`flip_on verifies ${migration} before setting the flag`, flipJob.indexOf(migration) > -1);
  assert(
    `${migration} check happens before OMNI_WA_CANONICAL mutation`,
    flipJob.indexOf(migration) < flipJob.indexOf("gh variable set OMNI_WA_CANONICAL"),
  );
}

for (const schemaGuard of [
  "omni_ai_jobs_type_valid",
  "wa_crm_sync",
  "run_after",
  "omni_ai_jobs_wa_crm_sync_active_dedup",
]) {
  assert(`flip_on validates prod schema guard ${schemaGuard}`, flipJob.includes(schemaGuard));
}

assert(
  "deploy dispatch stays pinned to main",
  flipJob.includes('gh workflow run deploy-calc-api.yml --repo "$GITHUB_REPOSITORY" --ref main'),
);

assert(
  "flip waits for the dispatched deploy to finish",
  flipJob.includes('gh run watch "$run_id" --repo "$GITHUB_REPOSITORY" --exit-status'),
);

assert(
  "flip verifies Cloud Run received the requested OMNI_WA_CANONICAL value",
  flipJob.includes("Verify Cloud Run OMNI_WA_CANONICAL") &&
    flipJob.includes('if [ "$actual" != "$expected" ]; then'),
);

assert(
  "workflow installs psql before psql-based prod checks",
  (workflow.match(/Install PostgreSQL client/g) || []).length >= 3,
);

console.log(`\nwaCanonicalCutoverWorkflow: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
