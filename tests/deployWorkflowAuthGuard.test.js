// Regression guard for the cockpit auth outage fixed in PR #298.
//
// The cockpit surface (/api/wolfboard/*, /api/crm/cockpit-token, agent voice,
// internal RBAC) 503s with "API_AUTH_TOKEN not configured" whenever the
// panelin-calc Cloud Run service boots without API_AUTH_TOKEN. That var (and
// IDENTITY_JWT_SECRET, which gates login) used to be set only by hand in the
// Cloud Run console — but the `deploy-cloudrun` action's `env_vars` input uses
// replace-semantics, so every deploy wiped any console-only var not also
// declared in deploy-calc-api.yml, silently re-breaking prod.
//
// This test fails fast (offline, in CI) if a future edit drops one of those
// boot-critical auth vars from the deploy step, so the outage cannot recur
// unnoticed. Extend AUTH_CRITICAL_ENV if more "absence == whole-surface-down"
// vars get added.
//
// SCOPE NOTE: this guard verifies the var is *declared for injection* (present
// in the env_vars block or --set-secrets flag). It cannot verify the value is
// non-empty — an unset GitHub secret (`NAME=${{ secrets.NAME }}` → "") would
// still 503 at runtime. That value-level check belongs to the ci.yml
// voice-health probe against prod, not to this offline unit test.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEPLOY_YAML = path.join(REPO_ROOT, ".github/workflows/deploy-calc-api.yml");

// Vars whose absence silently 503s an entire surface in production.
const AUTH_CRITICAL_ENV = ["API_AUTH_TOKEN", "IDENTITY_JWT_SECRET"];

assert.ok(fs.existsSync(DEPLOY_YAML), `deploy workflow not found: ${DEPLOY_YAML}`);
const yaml = fs.readFileSync(DEPLOY_YAML, "utf8");

/**
 * Names the deploy step actually injects into the Cloud Run service, parsed
 * ONLY from the `env_vars:` block and the `--set-secrets` flag — never from
 * free text, so a stray `NAME=` in a `run:`/smoke step or a comment cannot
 * satisfy the guard (which would give false confidence that an injection line
 * is still present after it was deleted).
 */
function injectedVarNames(text) {
  const names = new Set();

  // env_vars: |
  //   NAME=...   (indented block, terminated by the sibling `flags:` key)
  const envBlock = text.match(/\n[ \t]*env_vars:[ \t]*\|[ \t]*\n([\s\S]*?)\n[ \t]*flags:[ \t]*\|/);
  if (envBlock) {
    for (const line of envBlock[1].split("\n")) {
      const m = line.trim().match(/^([A-Z][A-Z0-9_]+)=/);
      if (m) names.add(m[1]);
    }
  }

  // --set-secrets=KEY=ref,KEY2=ref2,...  Comma-separated; each KEY may be a
  // path mount (/run/secrets/x=...) which we skip, and `ref` can be any
  // syntax (`secret:version` or full `projects/P/secrets/S/versions/V`) since
  // we only read the KEY left of the first `=`.
  for (const m of text.matchAll(/--set-secrets=(\S+)/g)) {
    for (const seg of m[1].split(",")) {
      const key = seg.split("=")[0].replace(/^.*\//, "");
      if (/^[A-Z][A-Z0-9_]+$/.test(key)) names.add(key);
    }
  }

  return names;
}

const injected = injectedVarNames(yaml);
const missing = AUTH_CRITICAL_ENV.filter((v) => !injected.has(v));
assert.deepEqual(
  missing,
  [],
  `deploy-calc-api.yml must inject these auth-critical vars in its env_vars block ` +
    `or --set-secrets flag, but they are missing: ${missing.join(", ")}. Dropping them ` +
    `re-introduces the cockpit 503 "API_AUTH_TOKEN not configured" outage — see PR #298.`,
);

console.log("deployWorkflowAuthGuard tests OK");
