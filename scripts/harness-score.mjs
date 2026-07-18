#!/usr/bin/env node
/**
 * BMC Harness Control System — composite scorecard.
 * Writes docs/team/harness/SCORECARD.json and prints summary.
 * Exit 0 if composite >= MIN_PASS (default 90), else 1.
 * Use --report-only to always exit 0 after writing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIN_PASS = Number(process.env.HARNESS_SCORE_MIN || 90);
const reportOnly = process.argv.includes("--report-only");

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
  } catch {
    return "";
  }
}

function countGlobDir(rel, re) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => re.test(f)).length;
}

function packageHasScript(name) {
  try {
    const pkg = JSON.parse(read("package.json"));
    return Boolean(pkg.scripts && pkg.scripts[name]);
  } catch {
    return false;
  }
}

function lineCount(rel) {
  const t = read(rel);
  if (!t) return 0;
  return t.split("\n").length;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** @returns {{ score: number, notes: string[] }} */
function dimGuideQuality() {
  const notes = [];
  let s = 0;
  const agentsLines = lineCount("AGENTS.md");
  if (agentsLines > 0 && agentsLines <= 80) {
    s += 5;
    notes.push(`AGENTS.md ${agentsLines} lines (≤80)`);
  } else if (agentsLines > 80) {
    s += 2;
    notes.push(`AGENTS.md ${agentsLines} lines (over 80)`);
  } else notes.push("AGENTS.md missing");

  if (exists("docs/team/harness/RULE-PROVENANCE.md")) {
    s += 3;
    notes.push("RULE-PROVENANCE present");
  } else notes.push("RULE-PROVENANCE missing");

  if (exists("CLAUDE.md")) {
    s += 1;
    notes.push("CLAUDE.md present");
  }
  if (exists("docs/team/SDD-HARNESS-ENGINEERING.md")) {
    s += 1;
    notes.push("SDD-HARNESS present");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimProgressiveDisclosure() {
  const notes = [];
  let s = 0;
  if (exists("docs/team/harness/SKILL-INDEX.md")) {
    s += 5;
    notes.push("SKILL-INDEX present");
  } else notes.push("SKILL-INDEX missing");
  const agents = read("AGENTS.md");
  if (/SKILL-INDEX|progressive|skill index/i.test(agents)) {
    s += 3;
    notes.push("AGENTS references skill index");
  } else notes.push("AGENTS missing skill-index pointer");
  if (exists("docs/team/harness/README.md")) {
    s += 2;
    notes.push("harness README present");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimComputationalSensors() {
  const notes = [];
  let s = 0;
  for (const scr of ["gate:local", "gate:local:full", "lint", "test", "test:api", "smoke:prod"]) {
    if (packageHasScript(scr)) {
      s += 1.2;
      notes.push(`script ${scr}`);
    }
  }
  if (packageHasScript("check:env-drift") || packageHasScript("gate:secrets")) {
    s += 1;
    notes.push("env/secrets drift scripts");
  }
  return { score: clamp(Math.round(s * 10) / 10, 0, 10), notes };
}

function dimEnforcementHooks() {
  const notes = [];
  let s = 0;
  if (exists(".claude/hooks/pre-tool-use.sh")) {
    s += 4;
    notes.push("pre-tool-use.sh");
  } else notes.push("pre-tool-use missing");
  if (exists(".claude/hooks/post-tool-use.sh")) {
    s += 4;
    notes.push("post-tool-use.sh");
  } else notes.push("post-tool-use missing");
  const settings = read(".claude/settings.json");
  if (/PreToolUse|pre-tool-use/i.test(settings)) {
    s += 1;
    notes.push("settings PreToolUse wired");
  }
  if (/PostToolUse|post-tool-use/i.test(settings)) {
    s += 1;
    notes.push("settings PostToolUse wired");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimArchitectureFitness() {
  const notes = [];
  let s = 0;
  if (packageHasScript("test:fitness") || exists("tests/architecture-fitness.test.js")) {
    s += 6;
    notes.push("fitness test present");
  } else notes.push("fitness test missing");
  if (exists("eslint-rules/bmc-help.js") || exists("eslint-rules/bmc-fitness.js")) {
    s += 2;
    notes.push("eslint custom rules");
  }
  if (exists("tests/architecture-fitness.test.js") && /sheet|secret|hardcod/i.test(read("tests/architecture-fitness.test.js"))) {
    s += 2;
    notes.push("fitness covers hardcode patterns");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimBehaviourGoldens() {
  const notes = [];
  let s = 0;
  const n = countGlobDir("tests/agentGolden/cases", /\.json$/);
  // 15+ → 7 pts; scale linearly
  const casePts = clamp((n / 15) * 7, 0, 7);
  s += casePts;
  notes.push(`agentGolden cases: ${n}`);
  if (packageHasScript("test:agent-golden")) {
    s += 1;
    notes.push("test:agent-golden script");
  }
  const cat = countGlobDir("evals/golden-cases", /^GC-.*\.test\.mjs$/);
  if (cat >= 4) {
    s += 1.5;
    notes.push(`catalog goldens: ${cat}`);
  } else {
    s += cat * 0.3;
    notes.push(`catalog goldens: ${cat}`);
  }
  if (packageHasScript("pre-release") && /GOLDEN|golden/i.test(JSON.stringify(JSON.parse(read("package.json")).scripts || {}))) {
    s += 0.5;
    notes.push("pre-release references goldens");
  }
  return { score: clamp(Math.round(s * 10) / 10, 0, 10), notes };
}

function dimInferentialEvals() {
  const notes = [];
  let s = 0;
  if (exists("evals/promptfoo") || exists("evals/promptfoo/presup-orchestrator.yaml")) {
    s += 4;
    notes.push("promptfoo suites present");
  }
  if (packageHasScript("eval:agent")) {
    s += 4;
    notes.push("eval:agent script");
  } else notes.push("eval:agent missing");
  if (exists(".claude/skills/promptfoo/SKILL.md") || exists("docs/team/harness/README.md")) {
    s += 2;
    notes.push("eval docs/skill");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimControlPlane() {
  const notes = [];
  let s = 0;
  if (exists("server/lib/assistantRegistry.js")) {
    s += 4;
    notes.push("assistantRegistry");
  }
  if (exists("server/middleware/requireAssistantEnabled.js")) {
    s += 2;
    notes.push("requireAssistantEnabled");
  }
  if (exists("tests/assistantControlPlane.test.js")) {
    s += 3;
    notes.push("assistantControlPlane tests");
  }
  if (exists("docs/team/harness/CONTROL-PLANE.md") || /ASSISTANTS_ACTIVE/.test(read("docs/team/harness/README.md"))) {
    s += 1;
    notes.push("control plane docs");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimObservability() {
  const notes = [];
  let s = 0;
  if (exists("server/lib/costTelemetry.js")) {
    s += 5;
    notes.push("costTelemetry module");
  } else notes.push("costTelemetry missing");
  const ac = read("server/lib/agentCore.js");
  if (/costTelemetry|logAgentCost|recordAgentCost/.test(ac)) {
    s += 3;
    notes.push("agentCore wired to cost telemetry");
  } else if (/TODO:.*cost-telemetry/.test(ac)) {
    s += 1;
    notes.push("agentCore still has cost-telemetry TODO");
  }
  if (exists("tests/cost-telemetry.test.js") || exists("tests/costTelemetry.test.js")) {
    s += 2;
    notes.push("cost telemetry tests");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimFlywheel() {
  const notes = [];
  let s = 0;
  if (exists(".claude/skills/harness-ratchet/SKILL.md")) {
    s += 5;
    notes.push("harness-ratchet skill");
  } else notes.push("harness-ratchet missing");
  if (exists("docs/team/harness/RATCHET-EXAMPLE.md")) {
    s += 3;
    notes.push("ratchet example");
  }
  if (exists("docs/team/harness/SCORECARD.json") || packageHasScript("harness:score")) {
    s += 2;
    notes.push("score feedback loop");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimLoopEngineering() {
  const notes = [];
  let s = 0;
  const readme = read("docs/team/harness/README.md");
  if (/PEV|Plan.?Execute.?Verify/i.test(readme)) {
    s += 6;
    notes.push("PEV documented in harness README");
  } else notes.push("PEV missing from harness README");
  if (exists("docs/team/SDD-HARNESS-ENGINEERING.md") && /PEV|Loop [ABCD]/i.test(read("docs/team/SDD-HARNESS-ENGINEERING.md"))) {
    s += 2;
    notes.push("PEV/loops in SDD");
  }
  if (/ship|closeout|live-fix/i.test(readme)) {
    s += 2;
    notes.push("aligned to ship/closeout/live-fix");
  }
  return { score: clamp(s, 0, 10), notes };
}

function dimSafetyHumanGates() {
  const notes = [];
  let s = 0;
  // Presence of human gates is the pass signal
  if (exists("server/middleware/requireGrant.js") || /requireGrant/.test(read("server/index.js"))) {
    s += 2;
    notes.push("requireGrant present");
  }
  if (exists("server/lib/finanzasUnlock.js") || exists("src/components/hub/finanzas/FinanzasUnlockGate.jsx")) {
    s += 2;
    notes.push("finanzas unlock present");
  }
  if (/user_confirmed/.test(read("server/lib/agentTools.js")) || /user_confirmed/.test(read("server/lib/coworkSheets.js") || "")) {
    s += 2;
    notes.push("user_confirmed pattern");
  } else {
    // search more broadly
    try {
      const tools = read("server/lib/agentTools.js");
      if (/confirm/i.test(tools)) {
        s += 1;
        notes.push("confirm pattern in agentTools");
      }
    } catch { /* ignore */ }
  }
  if (exists("docs/team/HUMAN-GATES-ONE-BY-ONE.md") || /human gate|non-goal|non-autonomy/i.test(read("docs/team/harness/README.md"))) {
    s += 2;
    notes.push("human gates documented");
  }
  if (exists("docs/team/harness/HARNESS-MAP.md") && /Non-goals|intentional/i.test(read("docs/team/harness/HARNESS-MAP.md"))) {
    s += 2;
    notes.push("non-goals in HARNESS-MAP");
  }
  return { score: clamp(s, 0, 10), notes };
}

const WEIGHTS = {
  guide_quality: 8,
  progressive_disclosure: 8,
  computational_sensors: 10,
  enforcement_hooks: 10,
  architecture_fitness: 8,
  behaviour_goldens: 10,
  inferential_evals: 8,
  control_plane: 8,
  observability_cost: 8,
  improvement_flywheel: 10,
  loop_engineering: 6,
  safety_human_gates: 6,
};

const dims = {
  guide_quality: dimGuideQuality(),
  progressive_disclosure: dimProgressiveDisclosure(),
  computational_sensors: dimComputationalSensors(),
  enforcement_hooks: dimEnforcementHooks(),
  architecture_fitness: dimArchitectureFitness(),
  behaviour_goldens: dimBehaviourGoldens(),
  inferential_evals: dimInferentialEvals(),
  control_plane: dimControlPlane(),
  observability_cost: dimObservability(),
  improvement_flywheel: dimFlywheel(),
  loop_engineering: dimLoopEngineering(),
  safety_human_gates: dimSafetyHumanGates(),
};

let weighted = 0;
let weightSum = 0;
const dimensions = {};
for (const [k, w] of Object.entries(WEIGHTS)) {
  const d = dims[k];
  const score10 = d.score;
  weighted += (score10 / 10) * w;
  weightSum += w;
  dimensions[k] = {
    weight: w,
    score_0_10: score10,
    contribution: Math.round(((score10 / 10) * w) * 100) / 100,
    notes: d.notes,
  };
}

const composite = Math.round((weighted / weightSum) * 1000) / 10;

// DoD D1–D12
const dod = {
  D1: exists("docs/team/harness/HARNESS-MAP.md"),
  D2: exists("docs/team/harness/RULE-PROVENANCE.md") && exists("AGENTS.md"),
  D3: exists(".claude/hooks/pre-tool-use.sh") && exists(".claude/hooks/post-tool-use.sh"),
  D4: exists("tests/architecture-fitness.test.js") || packageHasScript("test:fitness"),
  D5: packageHasScript("pre-release") && packageHasScript("test:catalog-goldens"),
  D6: packageHasScript("eval:agent"),
  D7: exists(".claude/skills/harness-ratchet/SKILL.md"),
  D8: exists("tests/assistantControlPlane.test.js") && exists("server/lib/assistantRegistry.js"),
  D9: exists("server/lib/costTelemetry.js") && /costTelemetry|logAgentCost|recordAgentCost/.test(read("server/lib/agentCore.js")),
  D10: composite >= MIN_PASS,
  D11: /PEV|Plan.?Execute.?Verify/i.test(read("docs/team/harness/README.md")),
  D12: exists("docs/team/harness/HARNESS-MAP.md") && /Non-goals|intentional/i.test(read("docs/team/harness/HARNESS-MAP.md")),
};

const dodGreen = Object.values(dod).filter(Boolean).length;
const dodTotal = Object.keys(dod).length;

const out = {
  generated_at: new Date().toISOString(),
  composite,
  min_pass: MIN_PASS,
  pass: composite >= MIN_PASS && dodGreen === dodTotal,
  dimensions,
  dod: {
    green: dodGreen,
    total: dodTotal,
    items: dod,
  },
  agent_golden_cases: countGlobDir("tests/agentGolden/cases", /\.json$/),
  catalog_goldens: countGlobDir("evals/golden-cases", /^GC-.*\.test\.mjs$/),
};

const outDir = path.join(ROOT, "docs/team/harness");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "SCORECARD.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

console.log(`BMC HCS scorecard: ${composite}/100  (min ${MIN_PASS})`);
console.log(`DoD: ${dodGreen}/${dodTotal} green`);
console.log(`pass=${out.pass}`);
console.log(`wrote ${path.relative(ROOT, outPath)}`);
for (const [k, v] of Object.entries(dimensions)) {
  console.log(`  ${k}: ${v.score_0_10}/10 (w=${v.weight})`);
}

if (reportOnly) process.exit(0);
process.exit(out.pass ? 0 : 1);
