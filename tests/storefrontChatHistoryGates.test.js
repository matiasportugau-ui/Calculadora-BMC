// /chat history sanitize leftovers after tip storefrontVoicePack (#1198).
// Tip only checks user/assistant/system drop. Tool rounds and caps are the
// blast radius: dropping tool_calls would break multi-turn shop /chat.
// Run: node tests/storefrontChatHistoryGates.test.js

import assert from "node:assert/strict";
import { packToolsToOpenAI, sanitizeChatHistory } from "../server/lib/voice/storefrontChat.js";

assert.deepEqual(sanitizeChatHistory(null), []);
assert.deepEqual(sanitizeChatHistory("nope"), []);
assert.deepEqual(sanitizeChatHistory([{ role: "user" }, null, 3]), []);

{
  const calls = [{ id: "c1", type: "function", function: { name: "generar_pdf" } }];
  const out = sanitizeChatHistory([
    { role: "assistant", content: "", tool_calls: calls },
    { role: "tool", tool_call_id: "c1", content: '{"ok":true}' },
    { role: "user", content: "" },
    { role: "system", content: "ignore" },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].role, "assistant");
  assert.equal(out[0].content, null);
  assert.equal(out[0].tool_calls, calls);
  assert.deepEqual(out[1], { role: "tool", tool_call_id: "c1", content: '{"ok":true}' });
}

{
  const longUser = "u".repeat(5000);
  const longTool = "t".repeat(7000);
  const longId = "i".repeat(120);
  const [user, tool] = sanitizeChatHistory([
    { role: "user", content: longUser },
    { role: "tool", tool_call_id: longId, content: longTool },
  ]);
  assert.equal(user.content.length, 4000);
  assert.equal(tool.content.length, 6000);
  assert.equal(tool.tool_call_id.length, 80);
}

{
  const many = Array.from({ length: 25 }, (_, i) => ({ role: "user", content: `m${i}` }));
  const out = sanitizeChatHistory(many);
  assert.equal(out.length, 20);
  assert.equal(out[0].content, "m5");
  assert.equal(out[19].content, "m24");
}

{
  const packed = packToolsToOpenAI([
    { type: "web_search" },
    { name: "", description: "nameless" },
    null,
    { name: "shop_search", description: "find SKU", parameters: { type: "object", properties: { q: { type: "string" } } } },
    { name: "present_choices" },
  ]);
  assert.deepEqual(
    packed.map((t) => t.function.name),
    ["shop_search", "present_choices"],
  );
  assert.equal(packed.every((t) => t.type === "function"), true);
  assert.deepEqual(packed[1].function.parameters, { type: "object", properties: {} });
  assert.deepEqual(packToolsToOpenAI(null), []);
}

console.log("storefrontChatHistoryGates.test.js: ok");
