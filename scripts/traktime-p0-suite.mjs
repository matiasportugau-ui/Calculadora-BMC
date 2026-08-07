#!/usr/bin/env node
/**
 * TraKtiMe P0 automated suite — ordered steps for human re-run / Matias approval.
 *
 *   node scripts/traktime-p0-suite.mjs
 *   node scripts/traktime-p0-suite.mjs --step 3
 *
 * Exit 0 only if all selected steps pass.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  {
    id: 1,
    name: "Contract (offline auth gates + health without DB)",
    cmd: ["node", "tests/traktime-contract.test.js"],
    expect: "health + 401 gates green",
  },
  {
    id: 2,
    name: "Jornada pure functions (UY gaps/idle)",
    cmd: ["node", "tests/traktime-jornada.test.js"],
    expect: "jornada effective/coordinación/pausa asserts green",
  },
  {
    id: 3,
    name: "Agent tools (identity + confirm + paths)",
    cmd: ["node", "tests/traktime-agent-tools.test.js"],
    expect: "traktime_requires_user_identity + confirmed writes + update/delete",
  },
  {
    id: 4,
    name: "P0 integration (shipped router + real DB)",
    cmd: ["node", "tests/traktime-p0-integration.test.js"],
    expect: "health ok, timer start/stop 409, day/month/billable",
  },
  {
    id: 5,
    name: "Detach / floating timer helpers",
    cmd: ["node", "tests/traktime-detach.test.js"],
    expect: "detach URL + PiP helpers",
  },
  {
    id: 6,
    name: "ActivityWatch opt-in (OFF default path)",
    cmd: ["node", "tests/traktime-activity.test.js"],
    expect: "tool degrades when AW disabled",
  },
];

const args = process.argv.slice(2);
let only = null;
const stepIdx = args.indexOf("--step");
if (stepIdx >= 0) only = Number(args[stepIdx + 1]);

const selected = only ? STEPS.filter((s) => s.id === only) : STEPS;
if (only && !selected.length) {
  console.error(`Unknown --step ${only}. Valid: ${STEPS.map((s) => s.id).join(", ")}`);
  process.exit(2);
}

console.log("═══ TraKtiMe P0 suite ═══");
console.log(`cwd: ${root}`);
console.log(`steps: ${selected.map((s) => s.id).join(", ")}\n`);

let failed = 0;
for (const step of selected) {
  console.log(`── Step ${step.id}: ${step.name}`);
  console.log(`   expect: ${step.expect}`);
  console.log(`   $ ${step.cmd.join(" ")}`);
  const r = spawnSync(step.cmd[0], step.cmd.slice(1), {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  const code = r.status ?? 1;
  if (code !== 0) {
    console.log(`   ✗ step ${step.id} exit ${code}\n`);
    failed++;
  } else {
    console.log(`   ✓ step ${step.id} ok\n`);
  }
}

if (failed) {
  console.log(`SUITE FAILED (${failed} step(s))`);
  process.exit(1);
}
console.log("SUITE OK — all selected P0 steps green");
process.exit(0);
