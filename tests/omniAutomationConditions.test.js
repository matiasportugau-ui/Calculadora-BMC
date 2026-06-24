// Automation condition DSL — node tests/omniAutomationConditions.test.js
import {
  evaluateConditions,
  buildAutomationContext,
} from "../server/lib/omni/orchestrator/automationConditions.js";

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

const ctx = buildAutomationContext({
  channel: "wa",
  message: { sender: "customer", body: "Necesito cotización techo 100m2" },
  body_ai_category: "cotizacion",
  conversation_id: "c1",
  conversation_priority: 1,
});

assert("channel eq wa", evaluateConditions({ all: [{ field: "channel", op: "eq", value: "wa" }] }, ctx));
assert(
  "body contains cotiz",
  evaluateConditions({ all: [{ field: "body", op: "contains", value: "cotiz" }] }, ctx),
);
assert(
  "category in list",
  evaluateConditions({ all: [{ field: "body_ai_category", op: "in", value: ["cotizacion", "product"] }] }, ctx),
);
assert(
  "none spam",
  evaluateConditions({ none: [{ field: "body_ai_category", op: "eq", value: "spam" }] }, ctx),
);
assert("empty conditions do not match", !evaluateConditions({}, ctx));

// matches operator — normal use
assert(
  "matches regex on body",
  evaluateConditions({ all: [{ field: "body", op: "matches", value: "cotiz.*techo" }] }, ctx),
);
// ReDoS guard: an over-long operator-supplied pattern is rejected (returns false),
// not compiled/run — so a catastrophic-backtracking pattern can't lock the loop.
assert(
  "matches rejects over-long pattern (ReDoS guard)",
  !evaluateConditions(
    { all: [{ field: "body", op: "matches", value: "a".repeat(201) }] },
    ctx,
  ),
);

console.log(`\nomniAutomationConditions: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
