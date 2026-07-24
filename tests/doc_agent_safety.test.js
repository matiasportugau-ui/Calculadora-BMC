#!/usr/bin/env node
/**
 * Offline tests for README Agent deterministic safety gates.
 * Runs scripts/doc_agent_safety.py helpers via a small Python harness (no Gemini).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const safetyPy = path.join(root, "scripts", "doc_agent_safety.py");

const harness = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(root, "scripts"))})
from doc_agent_safety import normalize_readme, validate_readme_update, REQUIRED_README_ANCHORS

cases = json.loads(sys.stdin.read())
out = []
for c in cases:
    if c["op"] == "normalize":
        out.append({"id": c["id"], "value": normalize_readme(c["text"])})
    elif c["op"] == "validate":
        ok, reason = validate_readme_update(c["current"], c["proposed"])
        out.append({"id": c["id"], "ok": ok, "reason": reason})
    elif c["op"] == "anchors":
        out.append({"id": c["id"], "anchors": list(REQUIRED_README_ANCHORS)})
print(json.dumps(out))
`;

function runCases(cases) {
  const r = spawnSync("python3", ["-c", harness], {
    cwd: root,
    input: JSON.stringify(cases),
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`python harness failed: ${r.stderr || r.stdout}`);
  }
  return JSON.parse(r.stdout);
}

const base = [
  "# Calculadora BMC — Panelin",
  "<!-- AUTO-GENERATED-BLOCK: scripts/generate-readme-presentation.mjs -->",
  "",
  "npm run dev:full",
  "see docs/readme/README.template.md",
  "",
  "## Licencia",
  "Código propietario",
  "",
].join("\n");

// Pad with filler (not duplicate anchors) so length-ratio checks have room.
const current = base + ("\n<!-- filler -->\n").repeat(400);

let failed = 0;
function check(name, cond, detail = "") {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

const results = runCases([
  {
    id: "strip-fence",
    op: "normalize",
    text: "```markdown\n" + base + "```\n",
  },
  {
    id: "reject-short",
    op: "validate",
    current,
    proposed: "# Calculadora BMC\nshort\n",
  },
  {
    id: "reject-missing-anchor",
    op: "validate",
    current,
    proposed: current.replaceAll(
      "<!-- AUTO-GENERATED-BLOCK: scripts/generate-readme-presentation.mjs -->",
      "<!-- removed auto block -->",
    ),
  },
  {
    id: "reject-identical",
    op: "validate",
    current,
    proposed: current,
  },
  {
    id: "accept-additive",
    op: "validate",
    current,
    proposed: current + "\n## Documentation Agent\n\n- daily\n",
  },
  { id: "anchors", op: "anchors" },
]);

const byId = Object.fromEntries(results.map((r) => [r.id, r]));

check(
  "normalize strips markdown fences",
  byId["strip-fence"].value.includes("# Calculadora BMC") &&
    !byId["strip-fence"].value.includes("```"),
);
check("reject truncated rewrite", byId["reject-short"].ok === false);
check("reject missing AUTO-GENERATED-BLOCK", byId["reject-missing-anchor"].ok === false);
check("reject identical noop", byId["reject-identical"].ok === false);
check("accept additive update", byId["accept-additive"].ok === true);
check(
  "required anchors include template + license",
  byId.anchors.anchors.includes("docs/readme/README.template.md") &&
    byId.anchors.anchors.includes("## Licencia"),
);

// Self-check entrypoint
const self = spawnSync("python3", [safetyPy], { cwd: root, encoding: "utf8" });
check("doc_agent_safety.py -- self-check", self.status === 0, self.stderr || self.stdout);

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll doc_agent_safety checks passed.");
