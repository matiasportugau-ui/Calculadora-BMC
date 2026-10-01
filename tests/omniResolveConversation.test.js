// tests/omniResolveConversation.test.js — offline mock for conversation
// create race: ON CONFLICT DO NOTHING + re-resolve (sibling of resolveContact).
import assert from "node:assert/strict";
import { resolveConversation } from "../server/lib/omni/identity/resolveConversation.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function makeClient({ insertReturnsRow, conversationAfterConflict }) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      const s = String(sql).replace(/\s+/g, " ");
      const insertedAlready = calls.some((c) => c.includes("INSERT INTO omni_conversations"));
      calls.push(s);
      if (s.includes("INSERT INTO omni_conversations")) {
        return { rows: insertReturnsRow ? [{ id: "conv-new" }] : [] };
      }
      if (s.includes("SELECT id FROM omni_conversations")) {
        if (!insertedAlready) return { rows: [] };
        return {
          rows:
            conversationAfterConflict || insertReturnsRow
              ? [{ id: conversationAfterConflict ? "conv-race" : "conv-new" }]
              : [],
        };
      }
      if (s.includes("UPDATE omni_conversations SET subject")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

const args = {
  contact_id: "contact-1",
  channel: "ig",
  conversation_hint: { channel_conversation_id: "igsid-abc" },
  source: "ig_webhook",
};

await check("creates a new conversation when none exists", async () => {
  const out = await resolveConversation(makeClient({ insertReturnsRow: true }), args);
  assert.equal(out.created, true);
  assert.equal(out.conversation_id, "conv-new");
  assert.equal(out.contact_id, "contact-1");
});

await check("re-resolves the racing conversation on ON CONFLICT (no drop)", async () => {
  const out = await resolveConversation(
    makeClient({ insertReturnsRow: false, conversationAfterConflict: true }),
    args,
  );
  assert.equal(out.created, false);
  assert.equal(out.conversation_id, "conv-race");
});

await check("throws if conflict but conversation still not found", async () => {
  await assert.rejects(
    resolveConversation(makeClient({ insertReturnsRow: false, conversationAfterConflict: false }), args),
    /not found on re-resolve/,
  );
});

await check("returns existing conversation without insert", async () => {
  const client = {
    async query(sql) {
      const s = String(sql).replace(/\s+/g, " ");
      if (s.includes("SELECT id FROM omni_conversations")) {
        return { rows: [{ id: "conv-existing" }] };
      }
      if (s.includes("UPDATE omni_conversations SET subject")) {
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${s}`);
    },
  };
  const out = await resolveConversation(client, {
    ...args,
    conversation_hint: { channel_conversation_id: "igsid-abc", subject: "hi" },
  });
  assert.equal(out.created, false);
  assert.equal(out.conversation_id, "conv-existing");
});

console.log(`\nomniResolveConversation: ${passed} passed`);
