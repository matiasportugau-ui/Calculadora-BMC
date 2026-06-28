// Offline tests for the Omni email channel: thread-aware ingest adapter +
// outbound reply (server/lib/omni/outbound/emailReply.js → Gmail transport).
// Run: node tests/omniEmailReply.test.js
import { emailIngestToOmniEvent } from "../server/lib/omni/adapters/emailIngest.js";
import { sendOmniEmailReply } from "../server/lib/omni/outbound/emailReply.js";

let passed = 0, failed = 0;
function assert(name, cond) { if (cond) passed++; else { failed++; console.error(`  ✗ ${name}`); } }
function group(n, fn) { console.log(`\n— ${n}`); return fn(); }

group("adapter: thread grouping + reply metadata", () => {
  const withThread = emailIngestToOmniEvent({
    cuerpo: "Hola, quiero cotizar", remitente: "Cliente <cli@x.com>",
    messageId: "<orig-1@mail.gmail.com>", threadId: "thread-777",
    account: "ventas@bmcuruguay.com.uy", asunto: "Cotización techo",
  });
  assert("groups by threadId", withThread.conversation_hint.channel_conversation_id === "email:thread-777");
  assert("stores raw rfc message id", withThread.message.metadata.rfc_message_id === "<orig-1@mail.gmail.com>");
  assert("stores receiving account", withThread.message.metadata.account === "ventas@bmcuruguay.com.uy");
  assert("stores sender email", withThread.message.metadata.email_remitente === "cli@x.com" || withThread.message.metadata.email_remitente === "Cliente <cli@x.com>");
  assert("had_message_id true", withThread.message.metadata.had_message_id === true);

  // Two messages in the same Gmail thread → same conversation id (groups a back-and-forth)
  const reply = emailIngestToOmniEvent({
    cuerpo: "Reenvío más datos", remitente: "cli@x.com",
    messageId: "<orig-2@mail.gmail.com>", threadId: "thread-777", account: "ventas@bmcuruguay.com.uy",
  });
  assert("same thread → same conversation", reply.conversation_hint.channel_conversation_id === withThread.conversation_hint.channel_conversation_id);

  // No threadId → falls back to per-message hash (still email:-prefixed)
  const noThread = emailIngestToOmniEvent({ cuerpo: "x", remitente: "a@b.com", messageId: "<m@x>" });
  assert("no threadId → hash fallback", /^email:[0-9a-f]{32}$/.test(noThread.conversation_hint.channel_conversation_id));
});

const GMAIL_ENV = {
  GMAIL_INGEST_REFRESH_TOKEN: "1//r", GOOGLE_DRIVE_CLIENT_ID: "cid", GOOGLE_DRIVE_CLIENT_SECRET: "csec",
};

await group("sendOmniEmailReply", async () => {
  let captured = null;
  const out = await sendOmniEmailReply({
    config: { emailReplyDefaultCasilla: "bmc-ventas" },
    to: "cli@x.com", subject: "Re: Cotización techo", text: "Gracias por tu consulta",
    inReplyTo: "<orig-1@mail.gmail.com>", account: "ventas@bmcuruguay.com.uy",
    env: GMAIL_ENV, sendRaw: (arg) => { captured = arg; return { id: "g-1", threadId: "t-1" }; },
  });
  assert("ok via gmail", out.ok === true && out.data?.transport === "gmail");
  assert("recipient passed", captured?.to === "cli@x.com");
  assert("threading header passed", captured?.inReplyTo === "<orig-1@mail.gmail.com>");
  assert("from = receiving box", captured?.from === "ventas@bmcuruguay.com.uy");

  const noRcpt = await sendOmniEmailReply({ config: {}, to: "", text: "x" });
  assert("no recipient → ok:false", noRcpt.ok === false && noRcpt.error === "email_no_recipient");

  // Not configured (no Gmail env, no SMTP accounts) → graceful ok:false
  const notConf = await sendOmniEmailReply({ config: {}, to: "a@b.com", text: "x", env: {} });
  assert("unconfigured → email_not_configured", notConf.ok === false && notConf.error === "email_not_configured");
});

console.log(`\nomniEmailReply: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
