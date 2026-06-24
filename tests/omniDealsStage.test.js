/**
 * Offline tests — omni deal stage machine (WAVE 4 F1).
 */
import assert from "node:assert/strict";
import {
  canTransition,
  normalizeStage,
  isTerminalStage,
  stageToCrmEstado,
  DEAL_STAGES,
} from "../server/lib/omni/deals/stageMachine.js";
import { extractDealFields } from "../server/lib/omni/deals/dealExtractor.js";

console.log("omniDealsStage.test.js");

assert.deepEqual(DEAL_STAGES.length, 6);
assert.equal(normalizeStage("LEAD"), "lead");
assert.equal(normalizeStage("invalid"), null);
assert.equal(canTransition("lead", "qualified"), true);
assert.equal(canTransition("lead", "closed_won"), false);
assert.equal(canTransition("negotiation", "closed_won"), true);
assert.equal(isTerminalStage("closed_won"), true);
assert.equal(isTerminalStage("lead"), false);
assert.ok(stageToCrmEstado("proposal").includes("Propuesta"));

const extracted = extractDealFields("Necesito cotizar techo 200m2 panel USD 1500", {
  contactName: "Juan",
});
assert.ok(extracted.signals.hasQuoteIntent);
assert.equal(extracted.value_usd, 1500);
assert.equal(extracted.stage, "qualified");

console.log("  ✓ stage machine + extractor heuristics");
console.log("omniDealsStage.test.js OK");
