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

console.log(`\nomniWaParity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
