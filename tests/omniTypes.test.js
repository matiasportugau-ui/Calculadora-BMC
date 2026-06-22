// OmniInboundEvent Zod validation — node tests/omniTypes.test.js
import {
  parseOmniInboundEvent,
  normalizeWaPhone,
  normalizeEmail,
  buildIntegrationUuid,
  buildIdempotencyKey,
} from "../server/lib/omni/types.js";
import { waWebhookToOmniEvent } from "../server/lib/omni/adapters/waWebhook.js";
import { mlQuestionToOmniEvent } from "../server/lib/omni/adapters/mlCrmRow.js";
import { emailIngestToOmniEvent } from "../server/lib/omni/adapters/emailIngest.js";

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

const baseEvent = {
  source: "manual",
  channel: "wa",
  idempotency_key: "wa:msg:test1",
  occurred_at: new Date().toISOString(),
  contact_hint: { wa_phone: "099123456" },
  conversation_hint: { channel_conversation_id: "59899123456@s.whatsapp.net" },
  message: { sender: "customer", body: "Hola" },
};

assert("valid WA event parses", parseOmniInboundEvent(baseEvent).success);

const bad = parseOmniInboundEvent({ ...baseEvent, channel: "invalid" });
assert("invalid channel rejected", !bad.success);

assert("normalizeWaPhone UY", normalizeWaPhone("099123456") === "+59899123456");
assert("normalizeEmail lower", normalizeEmail("Test@Example.com") === "test@example.com");
assert("integration uuid wa", buildIntegrationUuid({ wa_phone: "099123456" }, "wa").startsWith("wa:+"));
assert("idempotency key", buildIdempotencyKey("wa", "abc") === "wa:msg:abc");

const waEv = waWebhookToOmniEvent({
  msg: { id: "w1", text: { body: "Hola" }, timestamp: "1710000000" },
  chatId: "59899123456@s.whatsapp.net",
  contactName: "Test",
});
assert("wa webhook adapter", waEv?.channel === "wa" && waEv.message.body === "Hola");

const mlEv = mlQuestionToOmniEvent({
  q: { id: 123, text: "Precio?", date_created: "2026-01-01T12:00:00Z", from: { id: 99 }, item_id: "MLU1" },
  nickname: "buyer1",
  itemTitle: "Panel techo",
});
assert("ml adapter", mlEv?.channel === "ml" && mlEv.idempotency_key.includes("123"));

const emEv = emailIngestToOmniEvent({
  asunto: "Cotización",
  cuerpo: "Necesito paneles",
  remitente: "client@example.com",
  messageId: "msg-1",
});
assert("email adapter", emEv?.channel === "email");

console.log(`\nomniTypes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
