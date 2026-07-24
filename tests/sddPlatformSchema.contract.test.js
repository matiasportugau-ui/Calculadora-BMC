/**
 * Development-glory / SDD quality gate — structural contract for
 * docs/sdd/panelin-ai-agent-platform (SoT). Offline; no network required.
 *
 * Proves the shipped documentation package still meets schema + pass bar
 * after as-built polish (sdd-architect quality bar + quality-auditor).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SDD_DIR = path.join(ROOT, "docs/sdd/panelin-ai-agent-platform");
const SDD = path.join(SDD_DIR, "SDD.md");
const SCORECARD = path.join(SDD_DIR, "audit/SCORECARD.json");
const GAP = path.join(SDD_DIR, "audit/GAP-PLAN.md");
const AUDIT = path.join(SDD_DIR, "audit/AUDIT.md");
const GOLDENS_MD = path.join(SDD_DIR, "evidence/goldens.md");
const CASES = path.join(ROOT, "tests/agentGolden/cases");

assert.ok(fs.existsSync(SDD), "SDD.md must exist");
const sdd = fs.readFileSync(SDD, "utf8");

// Frontmatter keys
for (const key of ["title:", "version:", "date:", "status:"]) {
  assert.ok(sdd.includes(key), `frontmatter missing ${key}`);
}
assert.match(sdd, /^---[\s\S]*?^---/m, "YAML frontmatter fence");

// Sections 1–12
for (let n = 1; n <= 12; n++) {
  assert.match(sdd, new RegExp(`^## ${n}\\.`, "m"), `missing section ## ${n}.`);
}

// Diagrams + ADR + risks
assert.match(sdd, /C4Context/, "C4Context required");
assert.match(sdd, /C4Container/, "C4Container required");
assert.match(sdd, /sequenceDiagram/, "sequenceDiagram required");
assert.match(sdd, /### ADR-\d+/, "≥1 ADR required");
assert.match(sdd, /## 11\. Risks/, "risks section");
assert.match(sdd, /\| Risk \| Impact \|/, "risks table");

// No unreplaced {PLACEHOLDER} tokens
const placeholders = sdd.match(/\{[A-Z][A-Z0-9_]+\}/g) || [];
assert.equal(placeholders.length, 0, `placeholders found: ${placeholders.join(",")}`);

// As-built facts reconciled
assert.match(sdd, /\b55\b/, "tools 55");
assert.match(sdd, /22/, "goldens 22");
assert.match(sdd, /logAgentCost/, "SuperAgent/cost via logAgentCost");
assert.match(sdd, /provider_used/, "SSE done telemetry");
assert.match(sdd, /canales;ml;panelin|ASSISTANTS_ACTIVE/, "assistants snapshot");

// Scorecard pass ≥90
assert.ok(fs.existsSync(SCORECARD), "SCORECARD.json");
const sc = JSON.parse(fs.readFileSync(SCORECARD, "utf8"));
assert.equal(sc.min_pass, 90);
assert.equal(sc.pass, true, "pass must be true");
assert.ok(sc.composite >= 90, `composite ${sc.composite} < 90`);
const dims = [
  "schema_completeness",
  "c4_fidelity",
  "recreation_sufficiency",
  "evidence_grounding",
  "ai_architecture_depth",
  "crosscutting_wa",
  "adr_quality",
  "evolution_readiness",
];
for (const d of dims) {
  assert.ok(sc.dimensions?.[d]?.score_0_100 != null, `missing dimension ${d}`);
}

// GAP-PLAN / AUDIT present; no open P0 narrative
assert.ok(fs.existsSync(GAP));
assert.ok(fs.existsSync(AUDIT));
const gap = fs.readFileSync(GAP, "utf8");
const audit = fs.readFileSync(AUDIT, "utf8");
assert.match(gap, /P0/i);
assert.ok(
  /None open|P0.*0|zero open \*\*P0\*\*|P0 \/ P1 documentation[\s\S]*\*\*None/i.test(gap) ||
    /P0[\s\S]{0,80}None/i.test(gap),
  "GAP-PLAN should state no open P0",
);
assert.match(audit, /97|9[0-9]/, "AUDIT should mention composite");
assert.match(audit, /pass:\s*true|Pass ≥90|YES/i);

// Goldens on disk vs evidence narrative
const caseFiles = fs.readdirSync(CASES).filter((f) => f.endsWith(".json"));
assert.equal(caseFiles.length, 22, `disk goldens ${caseFiles.length} !== 22`);
const gmd = fs.readFileSync(GOLDENS_MD, "utf8");
assert.match(gmd, /\*\*22\*\*/, "goldens.md must claim 22");

console.log(
  `sddPlatformSchema.contract.test.js: ok (SDD composite=${sc.composite} pass=${sc.pass} goldens=${caseFiles.length})`,
);
