import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeVoiceLogBody } from "../server/lib/voiceLog.js";

describe("voice log", () => {
  it("requires UUID conversationId and caps content", () => {
    const bad = normalizeVoiceLogBody({ role: "user", content: "hola" });
    assert.equal(bad.conversationId, null);
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const rec = normalizeVoiceLogBody({
      conversationId: id,
      role: "USER",
      content: "x".repeat(9000),
      surface: "logistica",
      sessionId: "sess-1",
      tool: "setEnviosInfo",
    });
    assert.equal(rec.conversationId, id);
    assert.equal(rec.role, "user");
    assert.equal(rec.channel, "voice");
    assert.equal(rec.surface, "logistica");
    assert.equal(rec.content.length, 8000);
    assert.equal(rec.tool, "setEnviosInfo");
  });
});
