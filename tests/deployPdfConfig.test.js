// ---------------------------------------------------------------------------
// Regression guard for quote-PDF Cloud Run deploy settings.
//
// The AE agent waits up to 90s for /calc/cotizar/pdf. That route can queue
// behind the shared Chromium semaphore and then upload to GCS/Drive, so the
// Cloud Run request timeout must stay comfortably above the agent cap.
//
// Run: node tests/deployPdfConfig.test.js
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const WORKFLOW_PATH = path.join(REPO_ROOT, ".github/workflows/deploy-calc-api.yml");
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, ".env.example");
const CONFIG_PATH = path.join(REPO_ROOT, "server/config.js");

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  x ${label}`);
  }
}

function extractEnvKeys(workflow) {
  const match = workflow.match(/env_vars:\s*\|\s*\n([\s\S]*?)\n\s+flags:\s*\|/);
  if (!match) return new Set();
  return new Set(
    match[1]
      .split("\n")
      .map((line) => line.trim().match(/^([A-Z][A-Z0-9_]+)=/)?.[1])
      .filter(Boolean),
  );
}

function extractTimeoutSeconds(workflow) {
  const match = workflow.match(/--timeout=(\d+)/);
  return match ? Number(match[1]) : null;
}

const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
const envExample = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");
const config = fs.readFileSync(CONFIG_PATH, "utf8");
const envKeys = extractEnvKeys(workflow);
const timeoutSeconds = extractTimeoutSeconds(workflow);

assert(
  envKeys.has("COTIZAR_PDF_RENDER"),
  "deploy workflow propagates COTIZAR_PDF_RENDER to Cloud Run",
);
assert(
  /COTIZAR_PDF_RENDER=\$\{\{\s*vars\.COTIZAR_PDF_RENDER\s*\}\}/.test(workflow),
  "COTIZAR_PDF_RENDER is sourced from repo variables for emergency rollback",
);
assert(
  /#\s*COTIZAR_PDF_RENDER=/.test(envExample),
  ".env.example documents COTIZAR_PDF_RENDER",
);
assert(
  /process\.env\.COTIZAR_PDF_RENDER/.test(config),
  "server config reads COTIZAR_PDF_RENDER",
);
assert(
  timeoutSeconds >= 300,
  `Cloud Run timeout stays >=300s for queued Chromium renders (got ${timeoutSeconds})`,
);

console.log(`\n${failed === 0 ? "OK" : "FAIL"} deployPdfConfig: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
