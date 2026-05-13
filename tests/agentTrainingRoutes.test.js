// Regression test: the training router must evaluate cleanly so Cloud Run can boot.
// Run: node tests/agentTrainingRoutes.test.js

process.env.API_AUTH_TOKEN = "test-agent-training-routes";

let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    return;
  }
  failed += 1;
  console.error(`  ❌ ${label}`);
}

console.log("\n═══ agentTraining router boot regression ═══");

const mod = await import("../server/routes/agentTraining.js");

assert(!!mod?.default, "router module imports successfully");
assert(typeof mod.default === "function", "default export is an express router");

console.log(`\nagentTrainingRoutes: ${failed ? "FAILED" : "OK"}`);
process.exit(failed ? 1 : 0);
