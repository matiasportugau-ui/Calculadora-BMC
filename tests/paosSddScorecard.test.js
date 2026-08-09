import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sddPath = join(root, "docs/sdd/paos/SDD.md");
const scorePath = join(root, "docs/sdd/paos/audit/SCORECARD.json");
assert.ok(existsSync(sddPath), "SDD.md missing");
assert.ok(existsSync(scorePath), "SCORECARD missing");
const sdd = readFileSync(sddPath, "utf8");
const score = JSON.parse(readFileSync(scorePath, "utf8"));
for (const n of [1,2,3,4,5,6,7,8,9,10,11,12]) {
  assert.match(sdd, new RegExp(`^## ${n}\\.`, "m"), `section ${n}`);
}
assert.match(sdd, /C4Context/);
assert.match(sdd, /C4Container/);
assert.match(sdd, /sequenceDiagram/);
assert.match(sdd, /status:\s*Accepted/);
assert.match(sdd, /chat_turn|appendTrainingSessionEvent/);
assert.match(sdd, /panelin-calc/);
assert.match(sdd, /Development contract/);
assert.equal(score.pass, true);
// Skill min_pass is 90; user aspirational target 98 is tracked in SCORECARD.pass_user_target_98
const minPass = Number(score.min_pass) || 90;
assert.ok(Number(score.composite) >= minPass, `composite ${score.composite} < min_pass ${minPass}`);
for (const rel of [
  "docs/sdd/paos/SDD-TARGET.md",
  "docs/sdd/paos/ARCHITECT-FINAL.md",
  "docs/sdd/paos/IMPLEMENTATION-GUIDE.md",
  "docs/sdd/paos/DEVELOPMENT-GLORY.md",
  "docs/sdd/paos/ADRs/ADR-001-no-finetune.md",
  "docs/sdd/paos/evidence/turn-session-telemetry.md",
  "docs/sdd/paos/openapi-paos-sketch.yaml",
]) {
  assert.ok(existsSync(join(root, rel)), rel);
  assert.ok(readFileSync(join(root, rel), "utf8").length > 50, rel + " empty");
}
assert.match(readFileSync(join(root, "server/lib/trainingKB.js"), "utf8"), /appendTrainingSessionEvent/);
assert.match(readFileSync(join(root, "server/routes/agentChat.js"), "utf8"), /chat_turn/);
assert.match(readFileSync(join(root, "server/lib/toolStats.js"), "utf8"), /recordToolCall/);
console.log("paosSddScorecard.test.js PASS composite=", score.composite);
