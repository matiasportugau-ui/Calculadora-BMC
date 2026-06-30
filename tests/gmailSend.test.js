// Offline contract tests for server/lib/gmailSend.js + its integration into
// server/lib/emailReply.js (Gmail-API preferred transport, SMTP fallback).
// Run: node tests/gmailSend.test.js

import { isGmailSendConfigured, buildRawMessage, sendGmailReply } from "../server/lib/gmailSend.js";
import { sendEmailReply } from "../server/lib/emailReply.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); return fn(); }

// base64url → utf8 string
function decodeRaw(raw) {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

const GMAIL_ENV = {
  GMAIL_INGEST_REFRESH_TOKEN: "1//refresh",
  GMAIL_OAUTH_CLIENT_ID: "cid.apps.googleusercontent.com",
  GMAIL_OAUTH_CLIENT_SECRET: "csecret",
};

group("isGmailSendConfigured", () => {
  assert(isGmailSendConfigured(GMAIL_ENV) === true, "all three present → true");
  assert(isGmailSendConfigured({ ...GMAIL_ENV, GMAIL_INGEST_REFRESH_TOKEN: "" }) === false, "missing token → false");
  assert(isGmailSendConfigured({}) === false, "empty env → false");
});

group("buildRawMessage", () => {
  const raw = buildRawMessage({
    to: "juan@x.com",
    subject: "Re: Tu consulta",
    text: "hola mundo",
    inReplyTo: "orig-123@mail.gmail.com",
    from: "ventas@bmcuruguay.com.uy",
  });
  const decoded = decodeRaw(raw);
  assert(!/[+/=]/.test(raw), "raw is base64url (no +,/,=)");
  assert(/^From: ventas@bmcuruguay\.com\.uy$/m.test(decoded), "From header set when provided");
  assert(/^To: juan@x\.com$/m.test(decoded), "To header");
  assert(/^Subject: Re: Tu consulta$/m.test(decoded), "ASCII subject left plain");
  assert(/^In-Reply-To: <orig-123@mail\.gmail\.com>$/m.test(decoded), "In-Reply-To wrapped in <>");
  assert(/^References: <orig-123@mail\.gmail\.com>$/m.test(decoded), "References mirrors In-Reply-To");
  const bodyB64 = decoded.split("\r\n\r\n")[1];
  assert(Buffer.from(bodyB64, "base64").toString("utf8") === "hola mundo", "body base64-decodes to text");

  // already-bracketed Message-ID is not double-wrapped
  const raw2 = decodeRaw(buildRawMessage({ to: "a@b.com", inReplyTo: "<abc@x>" }));
  assert(/^In-Reply-To: <abc@x>$/m.test(raw2), "pre-bracketed id not double-wrapped");

  // non-ASCII subject → RFC2047 encoded; no From header when omitted
  const raw3 = decodeRaw(buildRawMessage({ to: "a@b.com", subject: "Cotización áéí" }));
  assert(/^Subject: =\?UTF-8\?B\?/m.test(raw3), "non-ASCII subject RFC2047-encoded");
  assert(!/^From:/m.test(raw3), "no From header when not supplied");

  let threw = null;
  try { buildRawMessage({}); } catch (e) { threw = e; }
  assert(threw && /no_recipient/.test(threw.message), "missing recipient throws");
});

await group("sendGmailReply (injected transport)", async () => {
  let captured = null;
  const out = await sendGmailReply({
    to: "juan@x.com",
    subject: "Re: hola",
    text: "cuerpo",
    inReplyTo: "<o-1@x>",
    env: GMAIL_ENV,
    sendRaw: (arg) => { captured = arg; return { id: "msg-1", threadId: "thr-1" }; },
  });
  assert(out.transport === "gmail" && out.messageId === "msg-1" && out.threadId === "thr-1", "returns gmail result");
  assert(out.accepted[0] === "juan@x.com", "accepted recipient");
  assert(captured && typeof captured.raw === "string" && !/[+/=]/.test(captured.raw), "transport got base64url raw");

  let threw = null;
  try { await sendGmailReply({ to: "a@b.com", text: "x", env: {} }); } catch (e) { threw = e; }
  assert(threw && threw.code === "not_configured", "no creds → not_configured");
});

await group("emailReply integration: Gmail preferred, SMTP fallback", async () => {
  // Gmail configured + injected sendRaw → routes to Gmail, no SMTP/accounts needed
  let gmailHit = null;
  const out = await sendEmailReply({
    account: "bmc-ventas",
    to: "Cliente <cli@x.com>",
    subject: "Re: Tu consulta",
    text: "respuesta",
    inReplyTo: "<orig@gmail>",
    env: GMAIL_ENV,
    sendRaw: (arg) => { gmailHit = arg; return { id: "g-9" }; },
  });
  assert(out.transport === "gmail" && out.messageId === "g-9", "send-approved path uses Gmail when configured");
  assert(gmailHit && gmailHit.to === "cli@x.com", "recipient extracted into Gmail transport");

  // No Gmail env → falls back to SMTP (injected sendMail)
  let smtpHit = null;
  const ACCOUNTS = [{
    id: "bmc-ventas", user: "ventas@bmcuruguay.com.uy",
    smtp: { host: "s111.nty.uy", port: 465, secure: true, user: "ventas@bmcuruguay.com.uy", passwordEnv: "P" },
  }];
  const out2 = await sendEmailReply({
    account: "bmc-ventas", to: "cli@x.com", subject: "Re", text: "x",
    accounts: ACCOUNTS, env: { P: "pw" },
    sendMail: (arg) => { smtpHit = arg; return { ok: true }; },
  });
  assert(out2.ok === true && smtpHit?.smtp.host === "s111.nty.uy", "SMTP fallback still works when Gmail unconfigured");

  // preferSmtp forces SMTP even when Gmail env is present
  let forced = null;
  await sendEmailReply({
    account: "bmc-ventas", to: "cli@x.com", subject: "Re", text: "x",
    accounts: ACCOUNTS, env: { ...GMAIL_ENV, P: "pw" }, preferSmtp: true,
    sendMail: (arg) => { forced = arg; return { ok: true }; },
  });
  assert(forced?.smtp.host === "s111.nty.uy", "preferSmtp overrides Gmail preference");
});

console.log(`\ngmailSend: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
