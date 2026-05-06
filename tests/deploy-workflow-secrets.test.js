#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/deploy-calc-api.yml", "utf8");

const setSecrets = workflow.match(/--set-secrets=([^\n]+)/)?.[1] || "";
const secretEnvNames = setSecrets
  .split(",")
  .map((entry) => entry.trim().split("=")[0])
  .filter((name) => /^[A-Z][A-Z0-9_]+$/.test(name));

const migrationArray =
  workflow.match(/TARGET_SECRET_ENVS=\(([^)]*)\)/)?.[1]?.trim().split(/\s+/) || [];

for (const name of secretEnvNames) {
  assert.ok(
    migrationArray.includes(name),
    `${name} is mounted via --set-secrets but missing from the Cloud Run env type migration guard`,
  );
}

assert.ok(
  workflow.includes("--remove-env-vars=\"${LEGACY_SECRET_ENVS}\""),
  "deploy workflow must remove legacy plaintext env vars before switching them to secret refs",
);

assert.ok(
  workflow.includes("--update-secrets=\"${UPDATE_SECRETS}\""),
  "deploy workflow must restore migrated env vars as Secret Manager refs before image deploy",
);

console.log(
  `deploy-workflow-secrets: ${secretEnvNames.length} secret env var(s) covered by migration guard`,
);
