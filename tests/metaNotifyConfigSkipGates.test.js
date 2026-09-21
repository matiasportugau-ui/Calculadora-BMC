// Meta notify skip leftovers after tip metaNotify + open #1244 / #1263.
// Tip pins empty-owner skip and Slack-only happy path. This file pins owner
// present without WA tokens (`whatsapp_not_configured`), whitespace Slack as
// unconfigured, enqueue early-return before defaultQueue reuse, and the
// notifyOwner wrapper.
// Do not re-land #1244 / #1248 / #1263.
// Run: node tests/metaNotifyConfigSkipGates.test.js

import assert from "node:assert/strict";
import {
  createNotifyQueue,
  enqueueNotifyOwner,
  isSlackConfigured,
  notifyOwner,
  resetNotifyQueueForTests,
} from "../server/lib/meta/notify.js";

resetNotifyQueueForTests();

const igEvent = {
  channel: "ig",
  contact_hint: { name: "Ana" },
  message: { sender: "customer", sender_id: "IGSID_1", body: "hola", metadata: {} },
};

assert.equal(isSlackConfigured({}), false);
assert.equal(isSlackConfigured({ slackWebhookUrl: "   " }), false, "whitespace webhook is not Slack");
assert.equal(isSlackConfigured({ slackBotToken: "xoxb", slackNotifyChannel: "   " }), false);
assert.equal(isSlackConfigured({ slackBotToken: "   ", slackNotifyChannel: "#ops" }), false);
assert.equal(isSlackConfigured({ slackBotToken: "xoxb", slackNotifyChannel: "" }), false);
assert.equal(isSlackConfigured({ slackWebhookUrl: "  https://hooks.slack.com/x  " }), true);
assert.equal(isSlackConfigured({ slackBotToken: " xoxb ", slackNotifyChannel: " #ops " }), true);

{
  const q = createNotifyQueue({
    config: { ownerWhatsapp: "59899111222" },
    getOwnerWhatsapp: () => "59899111222",
    now: () => 1_000,
    fetchImpl: async () => {
      throw new Error("must not fetch");
    },
  });
  const r = await q.notifyOwner({ event: igEvent, n: 1 });
  assert.equal(r.skipped, "whatsapp_not_configured");
  assert.equal(r.sent, undefined);
}

{
  const sent = [];
  const q = createNotifyQueue({
    config: { ownerWhatsapp: "59899111222" },
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => 1_000,
  });
  const r = await q.notifyOwner({ event: igEvent, n: 2 });
  assert.equal(r.sent, "immediate");
  assert.equal(sent.length, 1);
}

{
  resetNotifyQueueForTests();
  const r = await enqueueNotifyOwner({
    config: { ownerWhatsapp: "   " },
    event: igEvent,
    n: 3,
    fetchImpl: async () => {
      throw new Error("must not fetch");
    },
    send: async () => {
      throw new Error("must not send");
    },
  });
  assert.equal(r.skipped, "owner_whatsapp_empty");
}

{
  resetNotifyQueueForTests();
  const r = await enqueueNotifyOwner({
    config: { ownerWhatsapp: "59899111222" },
    event: igEvent,
    n: 4,
    fetchImpl: async () => {
      throw new Error("must not fetch");
    },
  });
  assert.equal(r.skipped, "whatsapp_not_configured");
}

{
  resetNotifyQueueForTests();
  const sent = [];
  const first = await enqueueNotifyOwner({
    config: {
      ownerWhatsapp: "59899",
      slackWebhookUrl: "https://hooks.slack.com/services/T/B/X",
    },
    event: igEvent,
    n: 5,
    send: async (text) => sent.push(text),
    now: () => 1_000,
  });
  assert.equal(first.sent, "immediate");
  assert.equal(sent.length, 1);

  const second = await enqueueNotifyOwner({
    config: { ownerWhatsapp: "" },
    event: igEvent,
    n: 6,
    send: async (text) => sent.push("LEAK " + text),
  });
  assert.equal(second.skipped, "owner_whatsapp_empty");
  assert.equal(sent.length, 1, "empty-owner enqueue must not hit frozen defaultQueue");
}

{
  resetNotifyQueueForTests();
  const r = await notifyOwner({
    config: { ownerWhatsapp: "" },
    event: igEvent,
  });
  assert.equal(r.skipped, "owner_whatsapp_empty");
}

resetNotifyQueueForTests();
console.log("metaNotifyConfigSkipGates.test.js: ok");
