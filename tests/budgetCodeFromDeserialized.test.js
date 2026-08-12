/**
 * Bug DS — stale quotationCode must not survive Drive/openBmc import.
 * Run: node tests/budgetCodeFromDeserialized.test.js
 */
import assert from "node:assert/strict";
import {
  budgetCodeFromDeserialized,
  deserializeProject,
} from "../src/utils/projectFile.js";

assert.equal(budgetCodeFromDeserialized({ _meta: { quotationCode: "BMC-2026-0042" } }), "BMC-2026-0042");
assert.equal(budgetCodeFromDeserialized({ _meta: { quotationCode: "  BMC-1  " } }), "BMC-1");
assert.equal(budgetCodeFromDeserialized({ _meta: { quotationCode: null } }), null);
assert.equal(budgetCodeFromDeserialized({ _meta: { quotationCode: "" } }), null);
assert.equal(budgetCodeFromDeserialized({ _meta: {} }), null);
assert.equal(budgetCodeFromDeserialized({}), null);
assert.equal(budgetCodeFromDeserialized(null), null);

const legacy = deserializeProject({ scenario: "solo_techo", proyecto: { nombre: "Sory" } });
assert.equal(budgetCodeFromDeserialized(legacy), null);

const withCode = deserializeProject({
  _meta: { quotationCode: "BMC-2026-0200" },
  scenario: "solo_techo",
});
assert.equal(budgetCodeFromDeserialized(withCode), "BMC-2026-0200");

console.log("budgetCodeFromDeserialized.test.js OK");
