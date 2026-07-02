// AI worker classify mapping — offline (no DB)
import { classifyIntent } from "../server/lib/waEnricher.js";
import { ALLOWED_AI_JOB_TYPES } from "../server/lib/omni/orchestrator/aiWorker.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

assert("cotizacion intent", classifyIntent("Necesito cotización para techo") === "cotizacion");
assert("chatter short", classifyIntent("ok") === "chatter");
assert("consulta tecnica", classifyIntent("Qué espesor de panel PIR?") === "consulta_tecnica");

// C1: 'assist' must be an allowed job type (mirrors migration 011 CHECK) so the
// assist route's cost-accounting INSERT no longer fails the CHECK constraint.
assert("assist is an allowed job type", ALLOWED_AI_JOB_TYPES.includes("assist"));
assert(
  "core job types preserved",
  ["classify", "suggest", "extract_deal", "embed"].every((t) => ALLOWED_AI_JOB_TYPES.includes(t)),
);

console.log(`\nomniAiWorker (offline): ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
