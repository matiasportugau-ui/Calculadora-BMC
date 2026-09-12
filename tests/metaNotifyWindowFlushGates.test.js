// Meta notify burst-window flush leftovers — #1229 / #1239.
// Tip metaNotify pins first-5 immediate + 6th queued + manual flush digest.
// This file pins window-rollover flush, single-overflow (no digest header),
// Slack-only echo skip, and scheduled-timer fail-soft.
// Run: node tests/metaNotifyWindowFlushGates.test.js

import assert from "node:assert/strict";
import {
  createNotifyQueue,
  formatOwnerNotification,
  resetNotifyQueueForTests,
} from "../server/lib/meta/notify.js";

resetNotifyQueueForTests();

const igEvent = {
  channel: "ig",
  contact_hint: { igsid: "IGSID_1", name: "Ana" },
  message: { sender: "customer", sender_id: "IGSID_1", body: "Hola", metadata: {} },
};

const fbEvent = {
  channel: "fb",
  contact_hint: { psid: "PSID_1", name: "Luis" },
  message: { sender: "customer", sender_id: "PSID_1", body: "Stock?", metadata: { type: "message" } },
};

// After 5 immediate + 1 overflow, crossing 60s flushes the overflow as a
// single line (not "Meta inbox · N eventos") then sends the new event immediately.
{
  const sent = [];
  let t = 10_000;
  const timers = [];
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => t,
    setTimeoutFn: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeoutFn: () => {},
  });
  for (let i = 1; i <= 5; i += 1) await q.notifyOwner({ event: igEvent, n: i });
  const sixth = await q.notifyOwner({ event: fbEvent, n: 6 });
  assert.equal(sixth.queued, true);
  assert.equal(sent.length, 5);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 60_000);

  t = 10_000 + 60_000;
  const seventh = await q.notifyOwner({ event: igEvent, n: 7 });
  assert.equal(seventh.sent, "immediate");
  assert.equal(sent.length, 7);
  assert.equal(sent[5], formatOwnerNotification({ event: fbEvent, n: 6 }));
  assert.equal(/Meta inbox ·/.test(sent[5]), false);
  assert.match(sent[6], /#7/);
}

// Two overflow items flushed on window rollover become one digest
{
  const sent = [];
  let t = 20_000;
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => t,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
  });
  for (let i = 1; i <= 5; i += 1) await q.notifyOwner({ event: igEvent, n: i });
  await q.notifyOwner({ event: fbEvent, n: 6 });
  await q.notifyOwner({ event: igEvent, n: 7 });
  assert.equal(sent.length, 5);

  t = 20_000 + 60_000;
  const next = await q.notifyOwner({ event: fbEvent, n: 8 });
  assert.equal(next.sent, "immediate");
  assert.equal(sent.length, 7);
  assert.match(sent[5], /Meta inbox · 2 eventos \(60s\)/);
  assert.match(sent[5], /#6/);
  assert.match(sent[5], /#7/);
  assert.match(sent[6], /#8/);
}

// Slack-only echo still skipped (notify layer, not webhook)
{
  const calls = [];
  const q = createNotifyQueue({
    config: {
      ownerWhatsapp: "",
      slackWebhookUrl: "https://hooks.slack.com/services/T000/B000/XXX",
    },
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, text: async () => "ok" };
    },
    now: () => 1_000,
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  });
  const echo = {
    ...igEvent,
    message: { ...igEvent.message, metadata: { is_echo: true } },
  };
  const r = await q.notifyOwner({ event: echo, n: 1 });
  assert.equal(r.skipped, "echo");
  assert.equal(calls.length, 0);
}

// Scheduled digest flush swallows send throws (timer path only)
{
  const warns = [];
  const sent = [];
  let flushFn;
  let failFlush = false;
  let warned;
  const warnedP = new Promise((resolve) => {
    warned = resolve;
  });
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => {
      if (failFlush) throw new Error("graph 500");
      sent.push(text);
    },
    now: () => 30_000,
    setTimeoutFn: (fn) => {
      flushFn = fn;
      return 1;
    },
    clearTimeoutFn: () => {},
    logger: {
      warn: (meta, msg) => {
        warns.push({ meta, msg });
        if (msg === "meta owner notify digest flush failed") warned();
      },
    },
  });
  for (let i = 1; i <= 5; i += 1) await q.notifyOwner({ event: igEvent, n: i });
  const sixth = await q.notifyOwner({ event: fbEvent, n: 6 });
  assert.equal(sixth.queued, true);
  assert.equal(sent.length, 5);
  assert.equal(typeof flushFn, "function");
  failFlush = true;
  flushFn();
  await warnedP;
  assert.equal(warns.length, 1);
  assert.equal(warns[0].msg, "meta owner notify digest flush failed");
  assert.equal(warns[0].meta?.err, "graph 500");
}

resetNotifyQueueForTests();
console.log("metaNotifyWindowFlushGates.test.js: ok");
