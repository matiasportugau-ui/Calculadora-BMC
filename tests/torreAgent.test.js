/**
 * T8: Torre HITL identity vs El Transportador; no auto-WA.
 * Run: node tests/torreAgent.test.js
 */
import assert from "node:assert/strict";
import { TRUCKER_ACTION_TYPES } from "../src/utils/logistica/truckerAgent.js";
import {
  TOWER_ACTION_TYPES,
  TOWER_NAME,
  applyTowerAction,
  towerVsTruckerOverlap,
  isTowerAction,
} from "../src/utils/logistica/torreAgent.js";
import { LOGISTICA_TOWER_FUNCTION_TOOLS, LOGISTICA_TOWER_INSTRUCTIONS } from "../server/lib/voice/logisticaTowerInstructions.js";
import { LOGISTICA_VOICE_FUNCTION_TOOLS } from "../server/lib/voice/logisticaTruckerInstructions.js";

console.log("torreAgent");

{
  assert.equal(TOWER_NAME, "Torre");
  assert.equal(towerVsTruckerOverlap().length, 0);
  assert.ok(!TOWER_ACTION_TYPES.includes("setTecho"));
  assert.ok(!TOWER_ACTION_TYPES.includes("setStopField"));
  assert.ok(TRUCKER_ACTION_TYPES.includes("proposeTripPlan"));
  assert.equal(isTowerAction("proposeTripPlan"), false);
  const truckerNames = LOGISTICA_VOICE_FUNCTION_TOOLS.map((t) => t.name);
  const towerNames = LOGISTICA_TOWER_FUNCTION_TOOLS.map((t) => t.name);
  assert.ok(!towerNames.includes("setTecho"));
  assert.ok(!truckerNames.includes("draftDriverDirective"));
  assert.ok(LOGISTICA_TOWER_INSTRUCTIONS.includes("Never send WhatsApp"));
  console.log("  ✓ allowlists disjoint from Transportador");
}

{
  const wa = applyTowerAction({}, { type: "sendWhatsApp", text: "hola" });
  assert.equal(wa.ok, false);
  assert.equal(wa.whatsapp, false);
  assert.equal(wa.applied, false);
  const outbox = applyTowerAction({}, { type: "notify_driver" });
  assert.equal(outbox.whatsapp, false);
  const packing = applyTowerAction({}, { type: "setStopField", field: "direccion" });
  assert.equal(packing.ok, false);
  const draft = applyTowerAction({}, { type: "draftDriverDirective", payload: { text: "tomá por ruta 8" } });
  assert.equal(draft.ok, true);
  assert.equal(draft.applied, false);
  assert.equal(draft.whatsapp, false);
  assert.equal(draft.proposal.needs_human_apply, true);
  console.log("  ✓ propose-only; WhatsApp never sent");
}

console.log("torreAgent OK");
