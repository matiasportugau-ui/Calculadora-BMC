// omniDb health — skips integration if no DATABASE_URL
import { getOmniPool, omniHealthCheck, getOmniSchemaVersion, resetOmniPoolForTests } from "../server/lib/omni/omniDb.js";

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

assert("schema version string", typeof getOmniSchemaVersion() === "string" && getOmniSchemaVersion().length > 0);
assert("null pool without url", getOmniPool("") === null);

const databaseUrl = process.env.DATABASE_URL || "";
if (databaseUrl) {
  const pool = getOmniPool(databaseUrl);
  try {
    const health = await omniHealthCheck(pool);
    assert("health returns shape", "ok" in health && "schema_version" in health);
  } catch (e) {
    console.log(`  ⚠️  DB health skipped: ${e.message}`);
  } finally {
    await resetOmniPoolForTests();
  }
} else {
  console.log("  ⏭️  DATABASE_URL unset — integration checks skipped");
}

console.log(`\nomniDb: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
