// Offline tests for team-assist rate limit config (S5 Phase A).
// Run: node tests/teamAssistRate.test.js
import assert from "node:assert/strict";
import { TEAM_ASSIST_CHAT_RATE } from "../server/routes/teamAssist.js";

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("teamAssist — rate limit config");

t("TEAM_ASSIST_CHAT_RATE has positive window and max", () => {
  assert.ok(TEAM_ASSIST_CHAT_RATE.windowMs >= 60_000);
  assert.ok(TEAM_ASSIST_CHAT_RATE.max >= 1);
});

t("default window is 15 minutes", () => {
  assert.equal(TEAM_ASSIST_CHAT_RATE.windowMs, 15 * 60 * 1000);
});

t("default max is 20 requests per window", () => {
  assert.equal(TEAM_ASSIST_CHAT_RATE.max, 20);
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
);
process.exit(fail === 0 ? 0 : 1);