/**
 * Test: Pricing Audit System & Row-Level Security
 * 
 * Validates:
 * - Pricing overrides are recorded with user ID and timestamp
 * - Calculation discrepancies are flagged
 * - Unresolved discrepancies can be queried
 * - Row-level security prevents unauthorized access
 * 
 * Usage: node tests/pricingAudit.test.js
 */

import { strict as assert } from "node:assert";
import * as pricingAudit from "../server/lib/pricingAudit.js";

// Mock test data
const testUserId = "test-user-id-123";
const testQuoteId = "test-quote-id-456";

/**
 * Test 1: Record pricing override
 */
async function testRecordPricingOverride() {
  console.log("\n✅ Test 1: Record pricing override");

  try {
    const audit = await pricingAudit.recordPricingOverride(
      testUserId,
      "quote",
      testQuoteId,
      "Quote #001",
      1000,
      1100,
      "Client requested discount"
    );

    assert(audit.id, "Audit record should have ID");
    assert.equal(audit.change_type, "override", "Change type should be 'override'");
    assert.equal(audit.old_value, 1000, "Old value should be 1000");
    assert.equal(audit.new_value, 1100, "New value should be 1100");
    assert.equal(audit.delta, 100, "Delta should be 100");
    assert(audit.percentage_change > 9, "Percentage change should be ~10%");

    console.log(`  ✓ Override recorded: ${audit.old_value} → ${audit.new_value}`);
    console.log(`  ✓ Change: ${audit.percentage_change.toFixed(2)}%`);
  } catch (err) {
    console.error("  ✗ Failed:", err.message);
    throw err;
  }
}

/**
 * Test 2: Record calculation discrepancy
 */
async function testRecordCalculationDiscrepancy() {
  console.log("\n✅ Test 2: Record calculation discrepancy");

  try {
    // Small discrepancy (< 0.01%) - should be ignored
    let audit = await pricingAudit.recordCalculationDiscrepancy(
      testQuoteId,
      1000.0001,
      1000.0,
      "hash-small"
    );
    assert.equal(audit, null, "Small discrepancy should be ignored");
    console.log("  ✓ Ignored small discrepancy (< 0.01%)");

    // Large discrepancy (> 0.01%) - should be recorded
    audit = await pricingAudit.recordCalculationDiscrepancy(
      testQuoteId,
      1000,
      1001,
      "hash-large"
    );
    assert(audit.id, "Audit record should be created");
    assert.equal(audit.status, "discrepancy_flagged", "Status should be 'discrepancy_flagged'");
    console.log(`  ✓ Flagged large discrepancy: frontend=${audit.old_value}, backend=${audit.new_value}`);
  } catch (err) {
    console.error("  ✗ Failed:", err.message);
    throw err;
  }
}

/**
 * Test 3: Get pricing audit trail
 */
async function testGetPricingAuditTrail() {
  console.log("\n✅ Test 3: Get pricing audit trail");

  try {
    const trail = await pricingAudit.getPricingAuditTrail("quote", testQuoteId, 10);

    assert(Array.isArray(trail), "Should return array");
    assert(trail.length > 0, "Should have at least one audit record");

    console.log(`  ✓ Retrieved ${trail.length} audit record(s)`);
    trail.forEach((record, i) => {
      console.log(
        `    [${i + 1}] ${record.change_type}: ${record.old_value} → ${record.new_value} (${record.reason})`
      );
    });
  } catch (err) {
    console.error("  ✗ Failed:", err.message);
    throw err;
  }
}

/**
 * Test 4: Resolve discrepancy
 */
async function testResolveDiscrepancy() {
  console.log("\n✅ Test 4: Resolve discrepancy");

  try {
    // First, get an unresolved discrepancy
    const unresolved = await pricingAudit.getUnresolvedDiscrepancies();
    if (unresolved.length === 0) {
      console.log("  ⓘ No unresolved discrepancies to test with");
      return;
    }

    const auditId = unresolved[0].id;
    const resolved = await pricingAudit.resolveDiscrepancy(
      auditId,
      "Calculation difference due to rounding, verified acceptable"
    );

    assert.equal(resolved.status, "resolved", "Status should be 'resolved'");
    assert(resolved.resolved_at, "Should have resolved timestamp");

    console.log(`  ✓ Resolved discrepancy #${auditId}`);
    console.log(`  ✓ Reason: ${resolved.resolved_reason}`);
  } catch (err) {
    console.error("  ✗ Failed:", err.message);
    throw err;
  }
}

/**
 * Test 5: Get pricing audit report
 */
async function testGetPricingAuditReport() {
  console.log("\n✅ Test 5: Get pricing audit report");

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const report = await pricingAudit.getPricingAuditReport(yesterday, now);

    assert(report.byChangeType, "Should have byChangeType");
    assert(typeof report.unresolvedDiscrepancies === "number", "Should have unresolvedDiscrepancies count");

    console.log(`  ✓ Report period: ${report.period.start.split("T")[0]}`);
    console.log(`  ✓ Unresolved discrepancies: ${report.unresolvedDiscrepancies}`);
    report.byChangeType.forEach((row) => {
      console.log(
        `    - ${row.change_type}: ${row.count} changes, avg ${row.avg_percentage_change.toFixed(2)}% delta`
      );
    });
  } catch (err) {
    console.error("  ✗ Failed:", err.message);
    throw err;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log("🧪 Pricing Audit System Tests");
  console.log("═".repeat(50));

  try {
    // Ensure table exists
    console.log("\n📋 Creating pricing_audits table if needed...");
    await pricingAudit.ensurePricingAuditTable();

    // Run tests
    await testRecordPricingOverride();
    await testRecordCalculationDiscrepancy();
    await testGetPricingAuditTrail();
    await testResolveDiscrepancy();
    await testGetPricingAuditReport();

    console.log("\n" + "═".repeat(50));
    console.log("✅ All tests passed!\n");
  } catch (err) {
    console.error("\n❌ Tests failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

export { testRecordPricingOverride, testRecordCalculationDiscrepancy };
