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
// boot-critical auth vars from the deploy workflow, so the outage cannot recur
// unnoticed. Extend AUTH_CRITICAL_ENV if more "absence == whole-surface-down"
// vars get added.

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
 * True when `name` is injected by the deploy step, via either:
 *   - env_vars block:  `            NAME=${{ secrets.NAME }}`
 *   - --set-secrets:   `...,NAME=secret-name:version` (or first `--set-secrets=NAME=...`)
 */
function isInjected(name) {
  const asEnvVar = new RegExp(`(^|\\n)\\s+${name}=`).test(yaml);
  const asSecret = new RegExp(`[=,]${name}=[^,\\s]+:[^,\\s]+`).test(yaml);
  return asEnvVar || asSecret;
}

const missing = AUTH_CRITICAL_ENV.filter((v) => !isInjected(v));
assert.deepEqual(
  missing,
  [],
  `deploy-calc-api.yml must inject these auth-critical vars (env_vars or --set-secrets), ` +
    `but they are missing: ${missing.join(", ")}. Dropping them re-introduces the cockpit ` +
    `503 "API_AUTH_TOKEN not configured" outage — see PR #298.`,
);

console.log("deployWorkflowAuthGuard tests OK");
