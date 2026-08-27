/**
 * Asserts shipped bmc-logistica SCORECARD pass (≥90).
 * Run: node tests/sddLogisticaScorecard.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scorePath = path.join(root, "docs/sdd/bmc-logistica/audit/SCORECARD.json");
const sddPath = path.join(root, "docs/sdd/bmc-logistica/SDD.md");

const raw = fs.readFileSync(scorePath, "utf8");
const card = JSON.parse(raw);
const sdd = fs.readFileSync(sddPath, "utf8");

assert.equal(card.sdd_path, "docs/sdd/bmc-logistica/SDD.md");
assert.equal(card.system_slug, "bmc-logistica");
assert.equal(card.min_pass, 90);
assert.equal(typeof card.composite, "number");
assert.equal(card.pass, true);
assert.ok(card.composite >= card.min_pass, `composite ${card.composite} < ${card.min_pass}`);

const dims = card.dimensions || {};
for (const key of [
  "schema_completeness",
  "c4_fidelity",
  "recreation_sufficiency",
  "evidence_grounding",
  "ai_architecture_depth",
  "crosscutting_wa",
  "adr_quality",
  "evolution_readiness",
]) {
  assert.ok(dims[key], `missing dimension ${key}`);
  assert.equal(typeof dims[key].score_0_100, "number");
}

assert.match(sdd, /## 1\. Introduction/);
assert.match(sdd, /\/conductor/);
assert.match(sdd, /\/logistica/);
assert.match(sdd, /driver_url/);
assert.match(sdd, /conductor\?t=/);

console.log(`sddLogisticaScorecard: pass composite=${card.composite} >= ${card.min_pass}`);
