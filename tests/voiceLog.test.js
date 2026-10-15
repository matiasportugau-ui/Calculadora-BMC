import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeVoiceLogBody } from "../server/lib/voiceLog.js";
import { logConversationTurn, conversationsDir } from "../server/lib/conversationLog.js";

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

  it("writes channel+surface+tool onto CONV jsonl", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmc-conv-"));
    process.env.CONVERSATIONS_DIR = dir;
    const id = "11111111-2222-3333-4444-555555555555";
    logConversationTurn(id, {
      turnIndex: 0,
      role: "user",
      content: "cómo estamos",
      channel: "voice",
      surface: "logistica",
      sessionId: "s1",
    });
    const files = fs.readdirSync(conversationsDir()).filter((f) => f.endsWith(".jsonl"));
    assert.equal(files.length, 1);
    const line = fs.readFileSync(path.join(conversationsDir(), files[0]), "utf8").trim().split("\n").pop();
    const rec = JSON.parse(line);
    assert.equal(rec.channel, "voice");
    assert.equal(rec.surface, "logistica");
    assert.equal(rec.content, "cómo estamos");
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CONVERSATIONS_DIR;
  });
});
