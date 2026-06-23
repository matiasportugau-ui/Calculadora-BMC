#!/usr/bin/env node
/**
 * WAVE 4 exit gate checklist.
 * Usage: SKIP_SMOKE_OMNI=1 npm run wave4:exit-gate
 */
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";

dotenv.config();

const checks = [];

function run(name, cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: false });
  const ok = r.status === 0;
  checks.push({ name, ok, exit: r.status, stderr: r.stderr?.slice(0, 200) });
  return ok;
}

run("gate_local", "npm", ["run", "gate:local"]);
run("omni_deals_stage", "node", ["tests/omniDealsStage.test.js"]);
run("omni_automation_conditions", "node", ["tests/omniAutomationConditions.test.js"]);
run("omni_ai_worker_offline", "node", ["tests/omniAiWorker.test.js"]);
run("test_omni_parity", "npm", ["run", "test:omni:parity"]);

if (process.env.SKIP_SMOKE_OMNI !== "1") {
  run("smoke_omni", "node", ["scripts/smoke-omni.mjs"]);
}

if (process.env.DATABASE_URL && process.env.SKIP_RECONCILE_DEALS !== "1") {
  run("reconcile_deals_dry", "node", ["scripts/omni-reconcile-deals.mjs", "--dry-run"]);
}

const report = {
  wave: 4,
  at: new Date().toISOString(),
  flags_expected_staging: {
    OMNI_AI_ORCHESTRATOR_ENABLED: "1",
    VITE_OMNI_INBOX: "1",
    VITE_OMNI_DEALS: "1",
  },
  checks,
  ready_for_wave5: checks.every((c) => c.ok),
  manual: [
    "HITL accept/reject E2E in staging",
    "F3 dual-write verified with reconcile drift < 10",
    "H4 eval report reviewed",
  ],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ready_for_wave5 ? 0 : 1);
