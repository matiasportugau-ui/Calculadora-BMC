#!/usr/bin/env node
/**
 * WAVE 3 exit gate checklist — staging validation helper.
 * Usage: BMC_API_BASE=... API_AUTH_TOKEN=... npm run wave3:exit-gate
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
run("omni_automation_conditions", "node", ["tests/omniAutomationConditions.test.js"]);
run("omni_ai_worker_offline", "node", ["tests/omniAiWorker.test.js"]);
run("omni_ml_parity", "node", ["tests/omniMlParity.test.js"]);
run("omni_wa_rules_parity", "node", ["tests/omniWaRulesParity.test.js"]);
run("test_omni_parity", "npm", ["run", "test:omni:parity"]);

const base = process.env.BMC_API_BASE || "http://localhost:3001";
if (process.env.SKIP_SMOKE_OMNI !== "1") {
  run("smoke_omni", "node", ["scripts/smoke-omni.mjs"]);
}

const report = {
  wave: 3,
  at: new Date().toISOString(),
  api_base: base,
  flags_expected_staging: {
    OMNI_AI_ORCHESTRATOR_ENABLED: "1",
    OMNI_AUTOMATION_ENABLED: "1",
    OMNI_EVENT_BUS_ENABLED: "1",
  },
  checks,
  ready_for_wave4: checks.every((c) => c.ok),
  manual: [
    "E1+E2 classify+suggest on ingest verified in staging",
    "F2 automation error rate <10% over 1h",
    "Runbooks RB-OMNI-001/003 exercised",
  ],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ready_for_wave4 ? 0 : 1);
