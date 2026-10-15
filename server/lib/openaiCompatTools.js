/**
 * Adapt Anthropic-native AGENT_TOOLS to OpenAI / xAI chat.completions
 * function-calling. Same executeTool dispatch as Claude/Gemini.
 */

/**
 * @param {Array<{ name: string, description?: string, input_schema?: object }>} anthropicTools
 * @returns {Array<{ type: "function", function: { name: string, description: string, parameters: object } }>}
 */
export function toOpenAITools(anthropicTools) {
  return (Array.isArray(anthropicTools) ? anthropicTools : []).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description || "",
      parameters:
        t.input_schema && typeof t.input_schema === "object"
          ? t.input_schema
          : { type: "object", properties: {} },
    },
  }));
}

/**
 * Merge streamed `delta.tool_calls` into an accumulator.
 * @param {Array<{ id: string, name: string, arguments: string }>} acc
 * @param {Array<object>|undefined} deltas
 */
export function accumulateOpenAIToolCallDeltas(acc, deltas) {
  const out = Array.isArray(acc) ? acc : [];
  if (!Array.isArray(deltas)) return out;
  for (const d of deltas) {
    const idx = Number.isInteger(d.index) ? d.index : out.length;
    while (out.length <= idx) out.push({ id: "", name: "", arguments: "" });
    if (d.id) out[idx].id = d.id;
    const fn = d.function || {};
    if (fn.name) out[idx].name = fn.name;
    if (fn.arguments) out[idx].arguments += fn.arguments;
  }
  return out;
}

export function openaiAssistantToolMessage(calls) {
  return {
    role: "assistant",
    content: null,
    tool_calls: (calls || []).map((c) => ({
      id: c.id,
      type: "function",
      function: { name: c.name, arguments: c.arguments || "{}" },
    })),
  };
}

export function openaiToolResultMessage(callId, content) {
  return {
    role: "tool",
    tool_call_id: callId,
    content: typeof content === "string" ? content : JSON.stringify(content ?? ""),
  };
}

export function isLogisticaCalcState(calcState = {}) {
  return calcState.logistica === true || calcState.module === "logistica";
}
