// ═══════════════════════════════════════════════════════════════════════════
// Unit + integration tests for scripts/gate-secrets-drift.mjs
//
// Guards the Cloud Run "--set-secrets is a full-replace list" footgun behind
// PRs #313 / #315 / #317: the gate must fail when a required secret is dropped
// from the deploy line, and the live manifest must match the live workflow.
//
// Run: node tests/gate-secrets-drift.test.js
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeMountKey,
  parseSetSecrets,
  parseManifest,
  parseProvisionedKeys,
  computeDrift,
} from "../scripts/gate-secrets-drift.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}
function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}
const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// ── normalizeMountKey ───────────────────────────────────────────────────────

group("normalizeMountKey", () => {
  assert(normalizeMountKey("ANTHROPIC_API_KEY") === "ANTHROPIC_API_KEY", "plain env key untouched");
  assert(
    normalizeMountKey("/run/secrets/service-account.json") === "service-account.json",
    "file mount reduced to basename",
  );
});

// ── parseSetSecrets ─────────────────────────────────────────────────────────

group("parseSetSecrets", () => {
  const sample =
    "          --set-secrets=/run/secrets/service-account.json=panelin-service-account:latest," +
    "IDENTITY_JWT_SECRET=IDENTITY_JWT_SECRET:latest,ML_CLIENT_SECRET=ML_CLIENT_SECRET:latest\n";
  const got = parseSetSecrets(sample);
  assert(
    eqSet(got, new Set(["service-account.json", "IDENTITY_JWT_SECRET", "ML_CLIENT_SECRET"])),
    "extracts each mount key incl. file basename",
  );
  assert(parseSetSecrets("no flag here").size === 0, "no flag -> empty set");
});

// ── parseManifest ───────────────────────────────────────────────────────────

group("parseManifest", () => {
  const got = parseManifest("# comment\n\nFOO\nBAR  # inline\n  BAZ\n");
  assert(eqSet(got, new Set(["FOO", "BAR", "BAZ"])), "drops comments/blanks/whitespace");
});

// ── parseProvisionedKeys ────────────────────────────────────────────────────

group("parseProvisionedKeys", () => {
  const sh = "HIGH_SENS_KEYS=(\n  ML_CLIENT_SECRET\n  WHATSAPP_ACCESS_TOKEN\n  not_a_key\n)\n";
  const got = parseProvisionedKeys(sh);
  assert(got.has("ML_CLIENT_SECRET") && got.has("WHATSAPP_ACCESS_TOKEN"), "parses array entries");
  assert(!got.has("not_a_key"), "ignores non-UPPER tokens");
  assert(parseProvisionedKeys("nothing").size === 0, "no array -> empty set");
});

// ── computeDrift (the core regression guard) ────────────────────────────────

group("computeDrift", () => {
  const base = {
    required: new Set(["A", "B", "C"]),
    deployed: new Set(["A", "B", "C"]),
    provisioned: new Set(["A", "B", "C"]),
  };
  let d = computeDrift(base);
  assert(d.missing.length === 0 && d.undeclared.length === 0, "aligned -> no fatal drift");

  // A required secret dropped from the deploy line == the #313/#315/#317 regression.
  d = computeDrift({ ...base, deployed: new Set(["A", "B"]) });
  assert(d.missing.length === 1 && d.missing[0] === "C", "dropped required secret -> MISSING");

  // A secret added to the deploy line but not the manifest.
  d = computeDrift({ ...base, deployed: new Set(["A", "B", "C", "D"]) });
  assert(d.undeclared.length === 1 && d.undeclared[0] === "D", "extra deploy secret -> UNDECLARED");

  // Provisioned to GSM but not mounted -> advisory only, never fatal.
  d = computeDrift({
    required: new Set(["A"]),
    deployed: new Set(["A"]),
    provisioned: new Set(["A", "WHATSAPP_ACCESS_TOKEN"]),
  });
  assert(d.missing.length === 0 && d.undeclared.length === 0, "GSM-only is not fatal");
  assert(d.gsmOnly.includes("WHATSAPP_ACCESS_TOKEN"), "GSM-only secret surfaced as advisory");
});

// ── integration: the live repo must already be green ────────────────────────

group("live repo manifest matches deploy workflow", () => {
  const required = parseManifest(
    fs.readFileSync(path.join(REPO_ROOT, ".github/required-cloud-run-secrets.txt"), "utf8"),
  );
  const deployed = parseSetSecrets(
    fs.readFileSync(path.join(REPO_ROOT, ".github/workflows/deploy-calc-api.yml"), "utf8"),
  );
  const provisioned = parseProvisionedKeys(
    fs.readFileSync(path.join(REPO_ROOT, "scripts/provision-secrets.sh"), "utf8"),
  );
  const { missing, undeclared } = computeDrift({ required, deployed, provisioned });
  assert(missing.length === 0, `no MISSING in live repo (got: ${missing.join(", ")})`);
  assert(undeclared.length === 0, `no UNDECLARED in live repo (got: ${undeclared.join(", ")})`);
});

// ── summary ─────────────────────────────────────────────────────────────────

console.log(`\n${failed === 0 ? "✅" : "❌"} gate-secrets-drift: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
