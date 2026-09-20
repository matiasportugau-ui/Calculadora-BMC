// Meta owner notify leftover after tip metaNotify + open #1244 Slack∥WA isolation.
// #1244 pins WA success + Slack HTTP 500 still reports sent:immediate.
// This file pins the inverse: Graph WA throw is NOT swallowed, even if Slack
// succeeds — enqueue stays {skipped:"error"}, never sent:immediate.
// No live Slack/Graph. Run: node tests/metaNotifyWaFailGates.test.js

import assert from "node:assert/strict";
import {
  createNotifyQueue,
  enqueueNotifyOwner,
  resetNotifyQueueForTests,
} from "../server/lib/meta/notify.js";

resetNotifyQueueForTests();

const igEvent = {
  channel: "ig",
  contact_hint: { igsid: "IGSID_1", name: "Ana" },
  message: { sender: "customer", sender_id: "IGSID_1", body: "Hola?", metadata: {} },
};

const prevFetch = globalThis.fetch;

try {
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: { message: "wa down" } }),
  });

  {
    const slackCalls = [];
    const q = createNotifyQueue({
      config: {
        ownerWhatsapp: "59899111222",
        whatsappAccessToken: "tok",
        whatsappPhoneNumberId: "PNID",
        slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/XXX",
      },
      fetchImpl: async (url) => {
        slackCalls.push(String(url));
        return { ok: true, status: 200, text: async () => "ok" };
      },
      now: () => 1_000,
      setTimeoutFn: () => 0,
      clearTimeoutFn: () => {},
    });
    await assert.rejects(
      () => q.notifyOwner({ event: igEvent, n: 1 }),
      (err) => {
        assert.match(String(err.message), /WhatsApp API: wa down/);
        assert.equal(String(err.message).includes("T000/B000/XXX"), false);
        return true;
      },
    );
    assert.equal(slackCalls.length, 1, "Slack still fires in parallel before Promise.all rejects");
    assert.match(slackCalls[0], /hooks\.slack\.com/);
  }

  {
    const q = createNotifyQueue({
      config: {
        ownerWhatsapp: "59899111222",
        whatsappAccessToken: "tok",
        whatsappPhoneNumberId: "PNID",
      },
      now: () => 1_000,
      fetchImpl: async () => {
        throw new Error("must not Slack-fetch on WA-only");
      },
    });
    await assert.rejects(() => q.notifyOwner({ event: igEvent, n: 2 }), /WhatsApp API: wa down/);
  }

  {
    resetNotifyQueueForTests();
    const slackCalls = [];
    const r = await enqueueNotifyOwner({
      config: {
        ownerWhatsapp: "59899111222",
        whatsappAccessToken: "tok",
        whatsappPhoneNumberId: "PNID",
        slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/YYY",
      },
      event: igEvent,
      n: 3,
      fetchImpl: async (url) => {
        slackCalls.push(String(url));
        return { ok: true, status: 200, text: async () => "ok" };
      },
    });
    assert.equal(r.skipped, "error");
    assert.match(String(r.error), /WhatsApp API: wa down/);
    assert.equal(r.sent, undefined, "WA Graph fail must not report sent:immediate");
    assert.equal(slackCalls.length, 1);
  }
} finally {
  globalThis.fetch = prevFetch;
  resetNotifyQueueForTests();
}

console.log("metaNotifyWaFailGates.test.js: ok");
