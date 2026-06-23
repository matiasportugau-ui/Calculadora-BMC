// Email parity helpers (offline) — node tests/omniEmailParity.test.js
import { emailIngestToOmniEvent, emailMessageIdHash, emailContentHash } from "../server/lib/omni/adapters/emailIngest.js";

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

const h1 = emailMessageIdHash("msg-abc");
const h2 = emailMessageIdHash("msg-abc");
const h3 = emailMessageIdHash("msg-xyz");

assert("hash stable", h1 === h2);
assert("hash differs", h1 !== h3);
assert("empty messageId returns null", emailMessageIdHash("") === null);
assert("content hash differs by body", emailContentHash({ remitente: "a@b.com", asunto: "Hi", cuerpo: "A" }) !== emailContentHash({ remitente: "a@b.com", asunto: "Hi", cuerpo: "B" }));

const ev = emailIngestToOmniEvent({
  cuerpo: "Consulta paneles",
  remitente: "a@b.com",
  messageId: "msg-abc",
  asunto: "Cotización",
});
assert("email channel", ev.channel === "email");
assert("conversation id prefix", ev.conversation_hint.channel_conversation_id.startsWith("email:"));

console.log(`\nomniEmailParity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
