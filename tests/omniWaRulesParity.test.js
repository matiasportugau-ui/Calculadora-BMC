// wa_rules → omni automation parity structure (offline)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrateScript = path.join(root, "scripts/omni-migrate-wa-rules.mjs");
const waRulesSql = path.join(root, "wa-package/migrations/015_wa_rules.sql");

assert("wa_rules migration exists", fs.existsSync(waRulesSql));
assert("omni migrate wa_rules script exists", fs.existsSync(migrateScript));

console.log(`\nomniWaRulesParity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
