// enqueueNotifyOwner leftover gates after #1229 / #1239.
// Tip metaNotify + open #1244/#1246 pin format / burst / Slack∥WA / flush.
// This file pins process-lifetime queue reuse, send-throw swallow, and the
// notifyOwner alias. Do not re-land those PRs.
// Run: node tests/metaNotifyQueueReuseGates.test.js

import assert from "node:assert/strict";
import {
  enqueueNotifyOwner,
  notifyOwner,
  resetNotifyQueueForTests,
} from "../server/lib/meta/notify.js";

const igEvent = {
  channel: "ig",
  contact_hint: { name: "Ana" },
  message: { sender: "customer", sender_id: "IGSID_1", body: "precio?", metadata: {} },
};

resetNotifyQueueForTests();

// First Slack-only config freezes defaultQueue — later WhatsApp-only payload
// still uses the first send/fetchImpl (pin current singleton, do not "fix").
{
  resetNotifyQueueForTests();
  const slackCalls = [];
  const first = await enqueueNotifyOwner({
    config: {
      ownerWhatsapp: "",
      slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/FIRST",
    },
    event: igEvent,
    n: 1,
    fetchImpl: async (url) => {
      slackCalls.push(url);
      return { ok: true, status: 200, text: async () => "ok" };
    },
  });
  assert.equal(first.sent, "immediate");
  assert.deepEqual(slackCalls, ["https://hooks.slack.com/services/T000/B000/FIRST"]);

  const waCalls = [];
  const second = await enqueueNotifyOwner({
    config: {
      ownerWhatsapp: "59899111222",
      whatsappAccessToken: "tok",
      whatsappPhoneNumberId: "PNID",
    },
    event: igEvent,
    n: 2,
    send: async () => {
      waCalls.push("wa");
      return { ok: true };
    },
    fetchImpl: async () => {
      throw new Error("second fetchImpl must not run while queue is frozen");
    },
  });
  assert.equal(second.sent, "immediate");
  assert.equal(waCalls.length, 0, "payload.send is ignored after first enqueue");
  assert.equal(slackCalls.length, 2, "frozen queue keeps first Slack fetchImpl");
}

// send throw is swallowed — never rejects the webhook persist path
{
  resetNotifyQueueForTests();
  const r = await enqueueNotifyOwner({
    config: {
      ownerWhatsapp: "59899111222",
      whatsappAccessToken: "tok",
      whatsappPhoneNumberId: "PNID",
    },
    event: igEvent,
    n: 3,
    send: async () => {
      throw new Error("graph down");
    },
  });
  assert.equal(r.skipped, "error");
  assert.equal(r.error, "graph down");
}

// notifyOwner is the public alias and shares the same default queue
{
  resetNotifyQueueForTests();
  const sent = [];
  const a = await notifyOwner({
    config: {
      ownerWhatsapp: "59899111222",
      whatsappAccessToken: "tok",
      whatsappPhoneNumberId: "PNID",
    },
    event: igEvent,
    n: 10,
    send: async (text) => {
      sent.push(text);
    },
  });
  assert.equal(a.sent, "immediate");
  const b = await enqueueNotifyOwner({
    config: {
      ownerWhatsapp: "59800000000",
      whatsappAccessToken: "other",
      whatsappPhoneNumberId: "OTHER",
    },
    event: igEvent,
    n: 11,
    send: async () => {
      throw new Error("must not replace frozen send");
    },
  });
  assert.equal(b.sent, "immediate");
  assert.equal(sent.length, 2);
  assert.match(sent[0], /#10/);
  assert.match(sent[1], /#11/);
}

resetNotifyQueueForTests();
console.log("metaNotifyQueueReuseGates.test.js: ok");
