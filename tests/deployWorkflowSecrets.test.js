// Regression guard for Cloud Run deploys that use destructive `--set-secrets`.
// Run: node --test tests/deployWorkflowSecrets.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const workflowPath = path.join(repoRoot, ".github/workflows/deploy-calc-api.yml");

function getCloudRunSecretTargets() {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const matches = [...workflow.matchAll(/--set-secrets=([^\n]+)/g)];
  const targets = new Set();

  for (const match of matches) {
    const raw = match[1].trim();
    for (const pair of raw.split(",")) {
      const [target] = pair.split("=");
      const envName = target.trim().replace(/^.*\//, "");
      if (/^[A-Z][A-Z0-9_]+$/.test(envName)) targets.add(envName);
    }
  }

  return targets;
}

describe("Cloud Run deploy workflow secrets", () => {
  it("preserves hardened production secrets when using --set-secrets", () => {
    const targets = getCloudRunSecretTargets();
    const required = [
      "API_AUTH_TOKEN",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GROK_API_KEY",
      "GEMINI_API_KEY",
      "ML_CLIENT_SECRET",
      "TOKEN_ENCRYPTION_KEY",
    ];

    for (const secret of required) {
      assert.ok(targets.has(secret), `${secret} must be present in deploy-calc-api.yml --set-secrets`);
    }
  });
});
