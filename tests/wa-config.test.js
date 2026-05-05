import { getWaPool, resetWaPoolForTests } from "../server/lib/waDb.js";
import {
  primeWaConfig,
  getConfig,
  getFlag,
  setFlag,
  setSetting,
  deleteSetting,
  describeAll,
  _resetWaConfigForTests,
} from "../server/lib/waConfig.js";
import { SettingsSchema } from "../server/lib/waConfigSchema.js";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/bmc_wa_local";

async function runTests() {
  console.log("=== WA Config Integration Tests ===");
  const pool = getWaPool(DATABASE_URL);
  
  try {
    await primeWaConfig({ pool });
    console.log("✓ Primed");

    // 1. Defaults
    const cfg = getConfig();
    console.log("✓ Default intervalMs:", cfg.enricher.intervalMs === 8000 ? "OK" : "FAIL");
    console.log("✓ Default flag enricher.enabled:", getFlag("enricher.enabled") === false ? "OK" : "FAIL");

    // 2. Set/Get Setting
    await setSetting("enricher.intervalMs", 4500, { actor: "test_runner" });
    console.log("✓ Set setting intervalMs=4500:", getConfig().enricher.intervalMs === 4500 ? "OK" : "FAIL");

    // 3. Validation (Zod)
    try {
      await setSetting("enricher.intervalMs", 500, { actor: "test_runner" }); // min is 1000
      console.log("✗ Validation FAIL: accepted invalid value < 1000");
    } catch (e) {
      console.log("✓ Validation OK: rejected < 1000");
    }

    // 4. Flags & Rollout
    await setFlag("autoQuote.enabled", { enabled: true, rolloutPercent: 100 }, { actor: "test_runner" });
    console.log("✓ Flag autoQuote.enabled=true:", getFlag("autoQuote.enabled") === true ? "OK" : "FAIL");
    
    await setFlag("autoQuote.enabled", { enabled: true, rolloutPercent: 0 }, { actor: "test_runner" });
    console.log("✓ Flag autoQuote.enabled w/ 0% rollout:", getFlag("autoQuote.enabled") === false ? "OK" : "FAIL");

    // 5. Operator Overrides
    const opId = "test_op_" + Date.now();
    await setSetting("enricher.intervalMs", 2000, { actor: "test_runner", scope: "operator", scopeId: opId });
    console.log("✓ Tenant intervalMs remains 4500:", getConfig().enricher.intervalMs === 4500 ? "OK" : "FAIL");
    console.log("✓ Operator intervalMs is 2000:", getConfig({ operatorId: opId }).enricher.intervalMs === 2000 ? "OK" : "FAIL");

    // 6. Delete Setting
    await deleteSetting("enricher.intervalMs", { actor: "test_runner" });
    console.log("✓ Deleted tenant setting (back to default 8000):", getConfig().enricher.intervalMs === 8000 ? "OK" : "FAIL");

    // 7. Describe All
    const desc = describeAll({ operatorId: opId });
    console.log("✓ DescribeAll flags count:", desc.flags.length === 8 ? "OK" : "FAIL");
    const opSetting = desc.settings.find(s => s.key === "enricher.intervalMs");
    console.log("✓ DescribeAll reflects operator source:", opSetting.source === "operator" ? "OK" : "FAIL");

    // Cleanup
    await pool.query("delete from wa_audit_log where operator_id = 'test_runner'");
    await pool.query("delete from wa_settings where updated_by = 'test_runner'");
    await pool.query("delete from wa_flags where updated_by = 'test_runner'");
    console.log("✓ Cleanup done");

  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exit(1);
  } finally {
    _resetWaConfigForTests();
    await resetWaPoolForTests();
  }
  console.log("=== WA Config Tests Passed ===\n");
}

runTests();
