/**
 * Pin: resolvePinnedConversation locks the authorized conversation so reply
 * persist cannot orphan an outbound copy under a merge-loser contact.
 *
 * Run: node tests/omniReplyPersistPin.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolvePinnedConversation } from "../server/lib/omni/identity/resolveConversation.js";

let passed = 0;
async function checkAsync(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const CONV = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CONTACT_AFTER_MERGE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

await checkAsync("resolvePinnedConversation: FOR UPDATE + returns current contact_id", async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      assert.match(sql, /omni_conversations/);
      assert.match(sql, /FOR UPDATE/);
      assert.deepEqual(params, [CONV]);
      return { rows: [{ id: CONV, contact_id: CONTACT_AFTER_MERGE }] };
    },
  };
  const out = await resolvePinnedConversation(client, CONV);
  assert.deepEqual(out, {
    conversation_id: CONV,
    created: false,
    contact_id: CONTACT_AFTER_MERGE,
  });
  assert.equal(queries.length, 1);
});

await checkAsync("resolvePinnedConversation: missing row throws PINNED_CONVERSATION_NOT_FOUND", async () => {
  const client = {
    async query() {
      return { rows: [] };
    },
  };
  let err;
  try {
    await resolvePinnedConversation(client, CONV);
  } catch (e) {
    err = e;
  }
  assert.equal(err?.code, "PINNED_CONVERSATION_NOT_FOUND");
});

check("reply route wires pinConversationId (static source pin)", () => {
  const src = fs.readFileSync(new URL("../server/routes/omni.js", import.meta.url), "utf8");
  assert.match(src, /pinConversationId:\s*conversationId/);
  assert.match(src, /normalizeAndPersist\(persistBody/);
});

check("normalizer pin path is opt-in (ingest still resolves contact)", () => {
  const src = fs.readFileSync(new URL("../server/lib/omni/normalizer.js", import.meta.url), "utf8");
  assert.match(src, /opts\.pinConversationId/);
  assert.match(src, /resolvePinnedConversation/);
  assert.match(src, /resolveContact\(client/);
});

console.log(`\nomniReplyPersistPin: ${passed} passed`);
