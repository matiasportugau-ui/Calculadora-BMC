#!/usr/bin/env node
/**
 * gate-secrets-drift.mjs — "gate 0" before any Cloud Run (re)deploy.
 *
 * `gcloud run deploy --set-secrets=...` is a FULL-REPLACE list: any secret not
 * named on that single line is stripped from `panelin-calc` on every deploy.
 * This gate fails when the live `--set-secrets` line in
 * `.github/workflows/deploy-calc-api.yml` diverges from the declared contract in
 * `.github/required-cloud-run-secrets.txt`, so the strip-regression behind
 * PRs #313 / #315 / #317 cannot recur unnoticed.
 *
 * Checks:
 *   FATAL    MISSING    — required by the manifest, absent from `--set-secrets`
 *                         (the regression: a deploy would strip this secret).
 *   FATAL    UNDECLARED — present in `--set-secrets`, absent from the manifest
 *                         (keeps the manifest honest; add it in the same PR).
 *   ADVISORY GSM-ONLY   — provisioned to Secret Manager by provision-secrets.sh
 *                         but not mounted on Cloud Run (e.g. WHATSAPP_ACCESS_TOKEN).
 *                         Informational only — never fails the gate.
 *
 * Exit codes: 0 = no drift, 1 = drift found, 2 = script error.
 *
 * Usage:
 *   node scripts/gate-secrets-drift.mjs          # human report
 *   node scripts/gate-secrets-drift.mjs --json   # JSON report (CI summary)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEPLOY_YAML = path.join(REPO_ROOT, ".github/workflows/deploy-calc-api.yml");
const MANIFEST = path.join(REPO_ROOT, ".github/required-cloud-run-secrets.txt");
const PROVISION_SH = path.join(REPO_ROOT, "scripts/provision-secrets.sh");

/** Normalize a `--set-secrets` left-hand mount target to a comparable key. */
export function normalizeMountKey(left) {
  // `/run/secrets/service-account.json` -> `service-account.json`; `KEY` -> `KEY`.
  return left.includes("/") ? left.replace(/^.*\//, "") : left;
}

/** Parse the set of mounted secret keys from a deploy workflow's text. */
export function parseSetSecrets(yamlText) {
  const keys = new Set();
  for (const m of yamlText.matchAll(/--set-secrets=([^\s]+)/g)) {
    for (const pair of m[1].split(",")) {
      const left = pair.split("=")[0];
      if (left) keys.add(normalizeMountKey(left.trim()));
    }
  }
  return keys;
}

/** Parse the declared manifest into a set of required keys (drops comments/blanks). */
export function parseManifest(text) {
  const keys = new Set();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line) keys.add(line);
  }
  return keys;
}

/** Parse the HIGH_SENS_KEYS array from provision-secrets.sh (best-effort). */
export function parseProvisionedKeys(shText) {
  const keys = new Set();
  const block = shText.match(/HIGH_SENS_KEYS=\(([\s\S]*?)\)/);
  if (!block) return keys;
  for (const tok of block[1].split(/\s+/)) {
    const k = tok.replace(/#.*$/, "").trim();
    if (/^[A-Z][A-Z0-9_]+$/.test(k)) keys.add(k);
  }
  return keys;
}

/** Pure diff between the manifest and the deployed `--set-secrets` set. */
export function computeDrift({ required, deployed, provisioned }) {
  const missing = [...required].filter((k) => !deployed.has(k)).sort();
  const undeclared = [...deployed].filter((k) => !required.has(k)).sort();
  // Advisory: provisioned to GSM but not mounted on Cloud Run.
  const gsmOnly = [...provisioned].filter((k) => !deployed.has(k)).sort();
  return { missing, undeclared, gsmOnly };
}

function readOrEmpty(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function main() {
  const asJson = process.argv.slice(2).includes("--json");

  if (!fs.existsSync(DEPLOY_YAML)) {
    console.error(`gate-secrets-drift: deploy workflow not found at ${DEPLOY_YAML}`);
    process.exit(2);
  }
  if (!fs.existsSync(MANIFEST)) {
    console.error(`gate-secrets-drift: manifest not found at ${MANIFEST}`);
    process.exit(2);
  }

  const required = parseManifest(readOrEmpty(MANIFEST));
  const deployed = parseSetSecrets(readOrEmpty(DEPLOY_YAML));
  const provisioned = parseProvisionedKeys(readOrEmpty(PROVISION_SH));

  if (deployed.size === 0) {
    console.error(
      "gate-secrets-drift: no `--set-secrets=` line found in deploy-calc-api.yml.\n" +
        "  Either the deploy step changed shape or the secret mounts were removed.",
    );
    process.exit(2);
  }

  const { missing, undeclared, gsmOnly } = computeDrift({ required, deployed, provisioned });
  const failed = missing.length > 0 || undeclared.length > 0;

  if (asJson) {
    console.log(
      JSON.stringify(
        { required: required.size, deployed: deployed.size, missing, undeclared, gsmOnly },
        null,
        2,
      ),
    );
    process.exit(failed ? 1 : 0);
  }

  console.log("═══ Cloud Run secrets drift gate ═══");
  console.log(`Required by manifest:        ${required.size}`);
  console.log(`Mounted by --set-secrets:    ${deployed.size}`);
  console.log("");

  if (missing.length) {
    console.log(`❌ MISSING (${missing.length}) — required but NOT in --set-secrets.`);
    console.log("   A deploy would STRIP these from panelin-calc. Add each to the");
    console.log("   --set-secrets= line in .github/workflows/deploy-calc-api.yml.");
    for (const k of missing) console.log(`     - ${k}`);
    console.log("");
  }

  if (undeclared.length) {
    console.log(`❌ UNDECLARED (${undeclared.length}) — in --set-secrets but NOT in the manifest.`);
    console.log("   Add each to .github/required-cloud-run-secrets.txt in this PR so");
    console.log("   the contract stays the single source of truth.");
    for (const k of undeclared) console.log(`     - ${k}`);
    console.log("");
  }

  if (gsmOnly.length) {
    console.log(`ℹ️  ADVISORY (${gsmOnly.length}) — provisioned to GSM but not mounted on Cloud Run.`);
    console.log("   May be intentional (used elsewhere) or a gap. Mount via --set-secrets");
    console.log("   if the API reads them at runtime. Does not fail this gate.");
    for (const k of gsmOnly) console.log(`     - ${k}`);
    console.log("");
  }

  if (!failed) {
    console.log("✅ No secrets drift — every required secret is on the deploy list.");
  }

  process.exit(failed ? 1 : 0);
}

// Only run when invoked directly, so tests can import the pure helpers.
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error("gate-secrets-drift error:", err?.message || err);
    process.exit(2);
  }
}
