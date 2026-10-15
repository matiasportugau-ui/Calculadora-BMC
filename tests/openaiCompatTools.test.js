import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AGENT_TOOLS } from "../server/lib/agentTools.js";
import {
  toOpenAITools,
  accumulateOpenAIToolCallDeltas,
  openaiAssistantToolMessage,
  openaiToolResultMessage,
  isLogisticaCalcState,
} from "../server/lib/openaiCompatTools.js";

describe("openaiCompatTools", () => {
  it("maps every AGENT_TOOL to OpenAI function shape", () => {
    const tools = toOpenAITools(AGENT_TOOLS);
    assert.equal(tools.length, AGENT_TOOLS.length);
    const calc = tools.find((t) => t.function.name === "calcular_cotizacion");
    assert.equal(calc.type, "function");
    assert.equal(calc.function.parameters.type, "object");
    assert.ok(calc.function.parameters.properties.scenario);
  });

  it("accumulates streamed tool_call deltas by index", () => {
    let acc = [];
    acc = accumulateOpenAIToolCallDeltas(acc, [
      { index: 0, id: "call_1", function: { name: "calcular_cotizacion", arguments: "{\"sce" } },
    ]);
    acc = accumulateOpenAIToolCallDeltas(acc, [
      { index: 0, function: { arguments: "nario\":\"solo_techo\"}" } },
    ]);
    assert.equal(acc[0].id, "call_1");
    assert.equal(acc[0].name, "calcular_cotizacion");
    assert.equal(JSON.parse(acc[0].arguments).scenario, "solo_techo");
  });

  it("builds assistant + tool messages for the next round", () => {
    const asst = openaiAssistantToolMessage([{ id: "c1", name: "get_calc_state", arguments: "{}" }]);
    assert.equal(asst.role, "assistant");
    assert.equal(asst.tool_calls[0].id, "c1");
    const tool = openaiToolResultMessage("c1", { ok: true });
    assert.equal(tool.role, "tool");
    assert.equal(tool.tool_call_id, "c1");
    assert.match(tool.content, /ok/);
  });

  it("skips calculator tools on logistica calcState", () => {
    assert.equal(isLogisticaCalcState({ logistica: true }), true);
    assert.equal(isLogisticaCalcState({ module: "logistica" }), true);
    assert.equal(isLogisticaCalcState({ scenario: "solo_techo" }), false);
  });
});
