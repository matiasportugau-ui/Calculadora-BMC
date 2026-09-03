/**
 * MCP in-memory calcState must not bleed across conversation keys.
 * Missing session key collapses to "default" — pin that so a later keying change is visible.
 * Complementary to open #1179 sessionKeyFromReq (headers only).
 * Run: node tests/mcpCalcStateIsolation.test.js
 */
import assert from "node:assert/strict";
import {
  getCalcState,
  setCalcState,
  _resetConversationStateForTests,
} from "../server/mcp/conversationState.js";

console.log("mcpCalcStateIsolation");

_resetConversationStateForTests();

{
  setCalcState("conv-a", { scenario: "solo_techo", listaPrecios: "venta", flete: 440 });
  setCalcState("conv-b", { scenario: "solo_fachada" });
  assert.equal(getCalcState("conv-a").scenario, "solo_techo");
  assert.equal(getCalcState("conv-a").listaPrecios, "venta");
  assert.equal(getCalcState("conv-a").flete, 440);
  assert.equal(getCalcState("conv-b").scenario, "solo_fachada");
  assert.equal(getCalcState("conv-b").listaPrecios, undefined);
  assert.equal(getCalcState("conv-b").flete, undefined);
}

{
  setCalcState("conv-a", { flete: 0 }, { replace: true });
  assert.equal(getCalcState("conv-a").flete, 0);
  assert.equal(getCalcState("conv-a").scenario, undefined, "replace wipes prior keys");
  assert.equal(getCalcState("conv-a").listaPrecios, undefined);
  assert.equal(getCalcState("conv-b").scenario, "solo_fachada", "other session untouched");
}

{
  setCalcState("", { scenario: "default-empty" });
  setCalcState(undefined, { listaPrecios: "web" });
  assert.equal(getCalcState("default").scenario, "default-empty");
  assert.equal(getCalcState("").listaPrecios, "web");
  assert.equal(getCalcState("default").listaPrecios, "web", "blank keys share default");
}

_resetConversationStateForTests();
console.log("mcpCalcStateIsolation: ok");
