// Offline contract tests for server/lib/emailReply.js
// Run: node tests/emailReply.test.js

import { extractEmailAddress, resolveCasillaSmtp, sendEmailReply } from "../server/lib/emailReply.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const ACCOUNTS = [
  {
    id: "bmc-ventas",
    user: "ventas@bmcuruguay.com.uy",
    smtp: { host: "s111.nty.uy", port: 465, secure: true, user: "ventas@bmcuruguay.com.uy", passwordEnv: "EMAIL_BMC_VENTAS_PASS" },
  },
];
const ENV = { EMAIL_BMC_VENTAS_PASS: "s3cret" };

group("extractEmailAddress", () => {
  assert(extractEmailAddress("Juan Pérez <juan@x.com>") === "juan@x.com", "name <addr>");
  assert(extractEmailAddress("JUAN@X.COM") === "juan@x.com", "lowercased bare");
  assert(extractEmailAddress("sin correo aquí") === "", "no address → empty");
  assert(extractEmailAddress(null) === "", "null → empty");
});

group("resolveCasillaSmtp", () => {
  const s = resolveCasillaSmtp("bmc-ventas", { accounts: ACCOUNTS, env: ENV });
  assert(s && s.host === "s111.nty.uy" && s.port === 465 && s.secure === true, "resolves host/port/secure");
  assert(s && s.pass === "s3cret" && s.from === "ventas@bmcuruguay.com.uy", "pass from env, from = casilla");
  assert(resolveCasillaSmtp("bmc-ventas", { accounts: ACCOUNTS, env: {} }) === null, "no password → null");
  assert(resolveCasillaSmtp("nope", { accounts: ACCOUNTS, env: ENV }) === null, "unknown casilla → null");
  assert(resolveCasillaSmtp("", { accounts: ACCOUNTS, env: ENV }) === null, "empty casilla → null");
});

await group("sendEmailReply (injected transport)", async () => {
  let captured = null;
  const out = await sendEmailReply({
    account: "bmc-ventas",
    to: "Juan <juan@x.com>",
    subject: "Re: Tu consulta",
    text: "hola",
    inReplyTo: "<orig-123@nty.uy>",
    accounts: ACCOUNTS,
    env: ENV,
    sendMail: (arg) => { captured = arg; return { ok: true }; },
  });
  assert(out && out.ok === true, "returns transport result");
  assert(captured?.message.to === "juan@x.com", "recipient extracted");
  assert(captured?.message.from === "ventas@bmcuruguay.com.uy", "from = casilla address");
  assert(captured?.message.inReplyTo === "<orig-123@nty.uy>" && captured?.message.references === "<orig-123@nty.uy>", "threading headers set");
  assert(captured?.smtp.host === "s111.nty.uy", "smtp passed through");
});

await group("sendEmailReply error paths", async () => {
  let threw = null;
  try {
    await sendEmailReply({ account: "bmc-ventas", to: "a@b.com", text: "x", accounts: ACCOUNTS, env: {} });
  } catch (e) { threw = e; }
  assert(threw && threw.code === "not_configured", "missing SMTP password → not_configured");

  threw = null;
  try {
    await sendEmailReply({ account: "bmc-ventas", to: "no address", text: "x", accounts: ACCOUNTS, env: ENV });
  } catch (e) { threw = e; }
  assert(threw && /no_recipient/.test(threw.message), "no recipient → throws");
});

console.log(`\nemailReply: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
