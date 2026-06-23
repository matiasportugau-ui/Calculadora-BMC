// AI worker classify mapping — offline (no DB)
import { classifyIntent } from "../server/lib/waEnricher.js";

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

console.log(`\nomniAiWorker (offline): ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
