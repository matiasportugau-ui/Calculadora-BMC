// Regression checks for the Cloud Run deploy workflow.
// These catch accidental removal of the env-var type migration guard that
// prevents Cloud Run from rejecting literal-env -> secret-env changes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const WORKFLOW = path.join(REPO_ROOT, ".github/workflows/deploy-calc-api.yml");

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  x ${label}`);
  }
}

function indexOfOrFail(text, needle, label) {
  const index = text.indexOf(needle);
  assert(index !== -1, label);
  return index;
}

const workflow = fs.readFileSync(WORKFLOW, "utf8");

console.log("\nCloud Run deploy workflow");

const normalizeIdx = indexOfOrFail(
  workflow,
  "Normalize secret-backed env var types",
  "normalization step exists",
);
const dockerIdx = indexOfOrFail(
  workflow,
  "Configure Docker for Artifact Registry",
  "docker setup step exists",
);
const deployIdx = indexOfOrFail(workflow, "Deploy to Cloud Run", "deploy step exists");
const trafficIdx = indexOfOrFail(
  workflow,
  "Route traffic to latest revision",
  "explicit traffic routing step exists",
);

assert(normalizeIdx < dockerIdx, "normalization happens before image build/push");
assert(normalizeIdx < deployIdx, "normalization happens before deploy");
assert(deployIdx < trafficIdx, "traffic is routed after deploy");

for (const name of ["SMTP_PASS", "WA_JWT_SECRET", "IDENTITY_JWT_SECRET"]) {
  assert(workflow.includes(`"${name}"`), `${name} is checked for stale inline type`);
  assert(workflow.includes(`${name}=${name}:latest`), `${name} is deployed from Secret Manager`);
}

assert(workflow.includes("--remove-env-vars=\"$STALE_INLINE_VARS\""), "stale literal env vars are removed");
assert(workflow.includes("--no-traffic"), "normalization revision is not assigned traffic");
assert(workflow.includes("--to-latest"), "deploy workflow restores traffic to latest revision");

if (failed) {
  console.error(`\n${failed} deploy workflow regression check(s) failed.`);
  process.exit(1);
}

console.log(`${passed} deploy workflow regression checks passed.`);
