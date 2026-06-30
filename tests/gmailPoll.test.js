// Offline tests for server/lib/gmailPoll.js (server-side Gmail ingest poller).
// Run: node tests/gmailPoll.test.js
import {
  parseAllowlist, matchedRecipient, recipientsBlob, extractBody, header, pollGmailOnce,
} from "../server/lib/gmailPoll.js";

let passed = 0, failed = 0;
function assert(name, cond) { if (cond) passed++; else { failed++; console.error(`  ✗ ${name}`); } }
function group(n, fn) { console.log(`\n— ${n}`); return fn(); }

const ALLOW = parseAllowlist("ventas@bmcuruguay.com.uy, info@bmcuruguay.com.uy , ML@BMCURUGUAY.COM.UY");

group("pure helpers", () => {
  assert("parseAllowlist trims + lowercases + splits", ALLOW.length === 3 && ALLOW[2] === "ml@bmcuruguay.com.uy");
  const toVentas = { headers: [{ name: "To", value: "Cliente <ventas@bmcuruguay.com.uy>" }] };
  assert("matchedRecipient finds To", matchedRecipient(toVentas, ALLOW) === "ventas@bmcuruguay.com.uy");
  const fwd = { headers: [{ name: "Delivered-To", value: "matias@gmail.com" }, { name: "X-Forwarded-To", value: "info@bmcuruguay.com.uy" }] };
  assert("matchedRecipient checks forwarded headers", matchedRecipient(fwd, ALLOW) === "info@bmcuruguay.com.uy");
  const noise = { headers: [{ name: "To", value: "matias.portugau@gmail.com" }, { name: "Subject", value: "Ventas, correct?" }] };
  assert("matchedRecipient ignores subject text (not fuzzy)", matchedRecipient(noise, ALLOW) === "");
  assert("empty allowlist → wildcard", matchedRecipient(noise, []) === "*");
  assert("recipientsBlob lowercases", recipientsBlob(toVentas).includes("ventas@bmcuruguay.com.uy"));

  const plain = { mimeType: "text/plain", body: { data: Buffer.from("hola plano", "utf8").toString("base64url") } };
  assert("extractBody text/plain", extractBody(plain) === "hola plano");
  const html = { mimeType: "text/html", body: { data: Buffer.from("<p>hola <b>html</b></p>", "utf8").toString("base64url") } };
  assert("extractBody strips html", extractBody(html) === "hola html");
  assert("header case-insensitive", header(toVentas, "to").includes("ventas@"));
});

// Fake Gmail client + ingest poster
function fakeGmail(messages) {
  const modified = [];
  return {
    _modified: modified,
    users: {
      labels: {
        list: async () => ({ data: { labels: [{ id: "L1", name: "bmc-ingested" }] } }),
        create: async () => ({ data: { id: "L1" } }),
      },
      messages: {
        list: async () => ({ data: { messages: messages.map((m) => ({ id: m.id })) } }),
        get: async ({ id }) => ({ data: messages.find((m) => m.id === id) }),
        modify: async ({ id }) => { modified.push(id); return { data: {} }; },
      },
    },
  };
}
const mk = (id, to, threadId = "t-" + id, subject = "Consulta") => ({
  id, threadId, snippet: "snip",
  payload: { headers: [{ name: "To", value: to }, { name: "Subject", value: subject }, { name: "Message-ID", value: `<${id}@x>` }, { name: "From", value: "cli@x.com" }],
    mimeType: "text/plain", body: { data: Buffer.from("cuerpo " + id, "utf8").toString("base64url") } },
});

await group("pollGmailOnce — allowlist gate + ingest + label", async () => {
  const msgs = [mk("a", "ventas@bmcuruguay.com.uy"), mk("b", "matias.portugau@gmail.com"), mk("c", "info@bmcuruguay.com.uy")];
  const gmail = fakeGmail(msgs);
  const posted = [];
  const r = await pollGmailOnce({
    gmail, allowlist: ALLOW, limit: 10,
    postIngest: async (p) => { posted.push(p); return { ok: true, deduped: false }; },
  });
  assert("scanned 3", r.scanned === 3);
  assert("sent 2 (allowlisted only)", r.sent === 2);
  assert("skipped 1 (personal inbox)", r.skipped === 1);
  assert("labeled the 2 ingested", gmail._modified.length === 2 && gmail._modified.includes("a") && gmail._modified.includes("c"));
  assert("payload carries threadId + account + rfc messageId", posted[0].threadId === "t-a" && posted[0].account === "ventas@bmcuruguay.com.uy" && posted[0].messageId === "<a@x>");
});

await group("pollGmailOnce — dedupe + dry run", async () => {
  const gmail = fakeGmail([mk("a", "ventas@bmcuruguay.com.uy")]);
  const r = await pollGmailOnce({ gmail, allowlist: ALLOW, postIngest: async () => ({ ok: true, deduped: true }) });
  assert("deduped counted, not sent", r.deduped === 1 && r.sent === 0);

  const gmail2 = fakeGmail([mk("a", "ventas@bmcuruguay.com.uy")]);
  let postedDry = 0;
  const rd = await pollGmailOnce({ gmail: gmail2, allowlist: ALLOW, dryRun: true, postIngest: async () => { postedDry++; return { ok: true }; } });
  assert("dry run posts nothing + no labels", postedDry === 0 && gmail2._modified.length === 0 && rd.scanned === 1);
});

console.log(`\ngmailPoll: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
