// Cloud Run deploy must not wipe Secret Manager env refs during image deploys.
// Run: node --test tests/deployWorkflowSecrets.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/deploy-calc-api.yml", "utf8");

describe("deploy-calc-api Cloud Run secret wiring", () => {
  it("uses non-destructive secret updates", () => {
    assert.match(workflow, /--update-secrets=/);
    assert.doesNotMatch(workflow, /--set-secrets=/);
  });

  it("preserves critical production secret env refs", () => {
    const requiredSecretRefs = [
      "/run/secrets/service-account.json=panelin-service-account:latest",
      "API_AUTH_TOKEN=API_AUTH_TOKEN:latest",
      "ML_CLIENT_SECRET=ML_CLIENT_SECRET:latest",
      "TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest",
      "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest",
      "OPENAI_API_KEY=OPENAI_API_KEY:latest",
      "GROK_API_KEY=GROK_API_KEY:latest",
      "GEMINI_API_KEY=GEMINI_API_KEY:latest",
    ];

    for (const ref of requiredSecretRefs) {
      assert.match(workflow, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});
