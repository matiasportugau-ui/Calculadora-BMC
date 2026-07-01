// WA parity helpers (offline) — node tests/omniWaParity.test.js
import { buildIdempotencyKey } from "../server/lib/omni/types.js";
import { waWebhookToOmniEvent } from "../server/lib/omni/adapters/waWebhook.js";
import { waExtensionMessageToOmniEvent } from "../server/lib/omni/adapters/waExtension.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

const webhook = waWebhookToOmniEvent({
  msg: { id: "m1", text: { body: "Hola" } },
  chatId: "chat1",
});
const ext = waExtensionMessageToOmniEvent({
  msg_id: "m1",
  chat_id: "chat1",
  text: "Hola",
  direction: "in",
  ts: new Date().toISOString(),
});

assert("same idempotency webhook vs extension", webhook.idempotency_key === ext.idempotency_key);
assert("dedup key format", buildIdempotencyKey("wa", "x").startsWith("wa:msg:"));

// Contract the canonical-mode wa_crm_sync flow relies on.
assert("webhook event channel is wa", webhook.channel === "wa");
assert("webhook message.sender is customer (pins enqueueIngestAiJobs gate)", webhook.message?.sender === "customer");
assert("webhook carries side_effects.wa_chat_id", webhook.side_effects?.wa_chat_id === "chat1");
assert("webhook conversation_hint matches chatId", webhook.conversation_hint?.channel_conversation_id === "chat1");

console.log(`\nomniWaParity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
