import { getWaPool, resetWaPoolForTests } from "../server/lib/waDb.js";
import { applyRoutingRules, previewRoutingRule } from "../server/lib/waRoutingRules.js";
import { primeWaConfig, setFlag, _resetWaConfigForTests } from "../server/lib/waConfig.js";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/bmc_wa_local";

async function runTests() {
  console.log("=== WA Routing Rules Integration Tests ===");
  const pool = getWaPool(DATABASE_URL);
  
  try {
    await primeWaConfig({ pool });
    // Enable flag
    await setFlag("routingRules.enabled", { enabled: true }, { actor: "test_runner" });

    // 1. Create a rule
    const ruleId = "test_rule_1";
    await pool.query(
      `insert into wa_rules (name, when_conditions, then_actions, priority)
       values ($1, $2, $3, 1)`,
      [
        "Assign Maldonado",
        JSON.stringify({ text_matches: ["maldonado", "punta del este"] }),
        JSON.stringify({ assign: "carlos", label: "maldonado" }),
      ]
    );

    // 2. Test applyRoutingRules
    const ctx = {
      chat_id: "test_chat_rules",
      phone: "+59899111222",
      contact_name: "Test Rules",
      text: "Quiero panel en Maldonado",
      intent: "cotizacion",
      ts: new Date()
    };
    
    // Ensure chat exists for update
    await pool.query("insert into wa_conversations (chat_id, phone) values ($1, $2) on conflict do nothing", [ctx.chat_id, ctx.phone]);

    const result = await applyRoutingRules(pool, ctx);
    console.log("✓ Rule Applied:", result.applied.length === 1 ? "OK" : "FAIL");
    
    const { rows: [conv] } = await pool.query("select owner_op, meta from wa_conversations where chat_id = $1", [ctx.chat_id]);
    console.log("✓ Assigned Correctly:", conv.owner_op === "carlos" ? "OK" : "FAIL");
    console.log("✓ Labeled Correctly:", conv.meta.labels?.includes("maldonado") ? "OK" : "FAIL");

    // 3. Test Preview
    const preview = await previewRoutingRule(pool, { text_matches: ["maldonado"] });
    console.log("✓ Preview Count > 0:", preview.count >= 1 ? "OK" : "FAIL");

    // Cleanup
    await pool.query("delete from wa_rules where name = 'Assign Maldonado'");
    await pool.query("delete from wa_conversations where chat_id = 'test_chat_rules'");
    await pool.query("delete from wa_audit_log where operator_id = 'test_runner'");
    await pool.query("delete from wa_flags where updated_by = 'test_runner'");
    console.log("✓ Cleanup done");

  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exit(1);
  } finally {
    _resetWaConfigForTests();
    await resetWaPoolForTests();
  }
  console.log("=== WA Routing Rules Tests Passed ===\n");
}

runTests();
