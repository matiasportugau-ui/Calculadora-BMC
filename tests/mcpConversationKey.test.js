/**
 * MCP conversation key from headers — sessions must not collapse to "default".
 * Complementary to open #1112 (do not re-land that paneliMcp isolation suite).
 * Run: node tests/mcpConversationKey.test.js
 */
import assert from "node:assert/strict";
import { sessionKeyFromReq } from "../server/mcp/conversationState.js";

console.log("mcpConversationKey");

{
  assert.equal(sessionKeyFromReq({}, null), "default");
  assert.equal(sessionKeyFromReq({ headers: {} }, ""), "default");
  assert.equal(
    sessionKeyFromReq({ headers: {} }, "transport-abc"),
    "transport-abc",
  );
  assert.equal(
    sessionKeyFromReq(
      { headers: { "mcp-session-id": "mcp-1" } },
      "transport-abc",
    ),
    "mcp-1",
  );
  assert.equal(
    sessionKeyFromReq(
      {
        headers: {
          "x-elevenlabs-conversation-id": "el-2",
          "mcp-session-id": "mcp-1",
        },
      },
      "transport-abc",
    ),
    "el-2",
  );
  assert.equal(
    sessionKeyFromReq(
      {
        headers: {
          "x-conversation-id": "conv-9",
          "x-elevenlabs-conversation-id": "el-2",
          "mcp-session-id": "mcp-1",
        },
      },
      "transport-abc",
    ),
    "conv-9",
  );
  console.log("  ✓ header precedence: x-conversation-id > elevenlabs > mcp-session-id > transport");
}

console.log("mcpConversationKey OK");
