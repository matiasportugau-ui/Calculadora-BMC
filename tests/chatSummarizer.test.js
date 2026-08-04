/**
 * Offline regression for server/lib/chatSummarizer.js
 * Token-budget history compression for agent chat — must not drop context on AI failure.
 *
 * Run: node --test tests/chatSummarizer.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeHistory } from "../server/lib/chatSummarizer.js";

function makeHistory(n) {
  const msgs = [];
  for (let i = 0; i < n; i++) {
    msgs.push({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg-${i} dimensiones 10x20 precio`,
    });
  }
  return msgs;
}

describe("summarizeHistory thresholds", () => {
  it("returns unchanged history when length <= 12", async () => {
    const messages = makeHistory(12);
    const r = await summarizeHistory(messages, {
      complete: async () => {
        throw new Error("should not call AI under threshold");
      },
    });
    assert.equal(r.summarized, false);
    assert.equal(r.messages, messages);
  });

  it("ignores non-array input", async () => {
    const r = await summarizeHistory(null);
    assert.equal(r.summarized, false);
    assert.equal(r.messages, null);
  });
});

describe("summarizeHistory compression", () => {
  it("keeps last 6 turns and prepends system summary", async () => {
    const messages = makeHistory(14);
    let seenUserMessage = "";
    const r = await summarizeHistory(messages, {
      complete: async ({ userMessage }) => {
        seenUserMessage = userMessage;
        return { text: "Resumen: techo 10x20 confirmado.", provider: "test" };
      },
    });
    assert.equal(r.summarized, true);
    assert.equal(r.messages.length, 7); // 1 summary + 6 recent
    assert.equal(r.messages[0].role, "system");
    assert.match(r.messages[0].content, /RESUMEN DE CONVERSACIÓN PREVIA/);
    assert.match(r.messages[0].content, /techo 10x20/);
    // Recent window is messages[8..13]
    assert.equal(r.messages[1].content, "msg-8 dimensiones 10x20 precio");
    assert.equal(r.messages[6].content, "msg-13 dimensiones 10x20 precio");
    // Transcript excludes recent turns
    assert.ok(seenUserMessage.includes("msg-0"));
    assert.ok(seenUserMessage.includes("msg-7"));
    assert.ok(!seenUserMessage.includes("msg-8"));
    assert.ok(!seenUserMessage.includes("msg-13"));
  });

  it("caps transcript sent to AI at 6000 chars", async () => {
    const messages = makeHistory(14).map((m, i) =>
      i < 8 ? { ...m, content: "X".repeat(2000) } : m,
    );
    let seenLen = 0;
    await summarizeHistory(messages, {
      complete: async ({ userMessage }) => {
        seenLen = userMessage.length;
        return { text: "ok", provider: "test" };
      },
    });
    assert.ok(seenLen <= 6000, `transcript length ${seenLen} must be ≤ 6000`);
  });

  it("on AI failure returns full original history untouched", async () => {
    const messages = makeHistory(14);
    const r = await summarizeHistory(messages, {
      complete: async () => {
        throw new Error("provider down");
      },
    });
    assert.equal(r.summarized, false);
    assert.equal(r.messages, messages);
    assert.equal(r.messages.length, 14);
  });
});
