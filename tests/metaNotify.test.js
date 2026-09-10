import assert from "node:assert/strict";
import crypto from "node:crypto";
import { config } from "../server/config.js";
import { handleMetaMessagingWebhook } from "../server/lib/omni/metaWebhookHandler.js";
import {
  channelLabel,
  createNotifyQueue,
  enqueueNotifyOwner,
  formatOwnerDigest,
  formatOwnerNotification,
  kindLabel,
  resetNotifyQueueForTests,
  resetNotifySeqForTests,
} from "../server/lib/meta/notify.js";

resetNotifyQueueForTests();
resetNotifySeqForTests();

// Regression (#1229): notify reads config.ownerWhatsapp ← OWNER_WHATSAPP.
// Without this key on appConfig, live enqueue always skips even when env is set.
assert.equal(Object.prototype.hasOwnProperty.call(config, "ownerWhatsapp"), true);
assert.equal(typeof config.ownerWhatsapp, "string");

const igEvent = {
  channel: "ig",
  kind: undefined,
  contact_hint: { igsid: "IGSID_1", name: "Ana" },
  message: { sender: "customer", sender_id: "IGSID_1", body: "Hola, precio del Cardelino?", metadata: {} },
};

const fbEvent = {
  channel: "fb",
  contact_hint: { psid: "PSID_1", name: "Luis" },
  message: { sender: "customer", sender_id: "PSID_1", body: "Tienen stock en Maldonado?", metadata: { type: "message" } },
};

const commentEvent = {
  channel: "ig",
  kind: "comment",
  post_title: "10% OFF + Envío Gratis!!!",
  contact_hint: { name: "María" },
  message: { sender: "customer", sender_id: "x", body: "Cuánto sale el de 2.60?", metadata: { kind: "comment" } },
};

assert.equal(channelLabel("ig"), "IG");
assert.equal(channelLabel("fb"), "FB");
assert.equal(kindLabel(igEvent), "DM");
assert.equal(kindLabel(commentEvent), "comentario");

const igLine = formatOwnerNotification({ event: igEvent, n: 7 });
assert.equal(igLine, '📩 IG DM #7 · Ana: "Hola, precio del Cardelino?"');

const fbLine = formatOwnerNotification({ event: fbEvent, n: 8 });
assert.equal(fbLine, '📩 FB DM #8 · Luis: "Tienen stock en Maldonado?"');

const commentLine = formatOwnerNotification({ event: commentEvent, n: 9 });
assert.match(commentLine, /^📩 IG comentario #9 · María:/);
assert.match(commentLine, /post: "10% OFF \+ Envío Gratis!!!"/);

const withDraft = formatOwnerNotification({
  event: igEvent,
  n: 3,
  draft: { text: "El Cardelino 2.60×1.80×1.91 sale USD 1290 IVA incl. 092 663 245" },
});
assert.match(withDraft, /💬 Borrador:/);
assert.match(withDraft, /→ OK 3 \/ EDITAR 3 <texto> \/ NO 3 \/ OCULTAR 3/);

const digest = formatOwnerDigest([
  { event: igEvent, n: 1 },
  { event: fbEvent, n: 2 },
]);
assert.match(digest, /^📩 Meta inbox · 2 eventos \(60s\)/);
assert.match(digest, /IG DM #1/);
assert.match(digest, /FB DM #2/);

// Disabled when OWNER_WHATSAPP empty
{
  const sent = [];
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "",
    send: async (text) => sent.push(text),
    now: () => 1_000,
  });
  const r = await q.notifyOwner({ event: igEvent, n: 1 });
  assert.equal(r.skipped, "owner_whatsapp_empty");
  assert.equal(sent.length, 0);
}

// Echo skipped
{
  const sent = [];
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => 1_000,
  });
  const echo = {
    ...igEvent,
    message: { ...igEvent.message, metadata: { is_echo: true } },
  };
  const r = await q.notifyOwner({ event: echo, n: 1 });
  assert.equal(r.skipped, "echo");
  assert.equal(sent.length, 0);
}

// First 5 in 60s send immediately
{
  const sent = [];
  let t = 10_000;
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => t,
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  });
  for (let i = 1; i <= 5; i += 1) {
    const r = await q.notifyOwner({ event: igEvent, n: i });
    assert.equal(r.sent, "immediate");
  }
  assert.equal(sent.length, 5);
  assert.match(sent[0], /#1/);
  assert.match(sent[4], /#5/);
}

// 6th in same 60s window → digest (overflow), not a 6th individual
{
  const sent = [];
  const timers = [];
  let t = 20_000;
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
  const seventh = await q.notifyOwner({ event: igEvent, n: 7 });
  assert.equal(seventh.queued, true);
  const flushed = await q.flush();
  assert.equal(flushed.digest, true);
  assert.equal(flushed.flushed, 2);
  assert.equal(sent.length, 6);
  assert.match(sent[5], /Meta inbox · 2 eventos/);
  assert.match(sent[5], /#6/);
  assert.match(sent[5], /#7/);
}

// Window reset after 60s: next event is immediate again
{
  const sent = [];
  let t = 30_000;
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => t,
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  });
  await q.notifyOwner({ event: igEvent, n: 1 });
  t = 30_000 + 60_000;
  const r = await q.notifyOwner({ event: fbEvent, n: 2 });
  assert.equal(r.sent, "immediate");
  assert.equal(sent.length, 2);
}

// Webhook hook: persist success enqueues notify; duplicate / flag-off / bad sig do not
{
  const sample = (senderId, mid, text) => ({
    object: "page",
    entry: [{
      id: "page_1",
      messaging: [{
        sender: { id: senderId, name: "Cliente Test" },
        recipient: { id: "page_1" },
        timestamp: 1_783_515_000,
        message: { mid, text },
      }],
    }],
  });
  const raw = Buffer.from(JSON.stringify(sample("PSID_9", "mid_ok", "precio?")));
  const sig = "sha256=" + crypto.createHmac("sha256", "secret").update(raw).digest("hex");
  const notified = [];
  const good = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: sig,
    config: { databaseUrl: "postgres://unused", ownerWhatsapp: "59899" },
    persist: async (event) => ({ duplicate: false, message_id: "m1", event }),
    notifyOwner: async (payload) => { notified.push(payload); return { sent: "immediate" }; },
  });
  assert.equal(good.status, 200);
  await good.processing;
  assert.equal(notified.length, 1);
  assert.equal(notified[0].event.channel, "fb");
  assert.equal(notified[0].event.message.body, "precio?");

  const dupNotified = [];
  const dup = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: sig,
    config: {},
    persist: async () => ({ duplicate: true, message_id: "m1" }),
    notifyOwner: async (payload) => { dupNotified.push(payload); },
  });
  await dup.processing;
  assert.equal(dupNotified.length, 0);

  const offNotified = [];
  const off = handleMetaMessagingWebhook({
    channel: "ig",
    enabled: false,
    appSecret: "secret",
    rawBodyBuffer: raw,
    signatureHeader: sig,
    config: {},
    persist: async () => ({ duplicate: false }),
    notifyOwner: async (payload) => { offNotified.push(payload); },
  });
  await off.processing;
  assert.equal(offNotified.length, 0);
}

// enqueueNotifyOwner must honor config.ownerWhatsapp (appConfig key from OWNER_WHATSAPP)
{
  resetNotifyQueueForTests();
  const sent = [];
  const rEmpty = await enqueueNotifyOwner({
    event: igEvent,
    config: { ownerWhatsapp: "", whatsappAccessToken: "t", whatsappPhoneNumberId: "p" },
    send: async (text) => sent.push(text),
  });
  assert.equal(rEmpty.skipped, "owner_whatsapp_empty");
  assert.equal(sent.length, 0);

  resetNotifyQueueForTests();
  const rOk = await enqueueNotifyOwner({
    event: igEvent,
    config: { ownerWhatsapp: "59899111222", whatsappAccessToken: "t", whatsappPhoneNumberId: "p" },
    send: async (text) => sent.push(text),
    now: () => 50_000,
    setTimeoutFn: () => 0,
    clearTimeoutFn: () => {},
  });
  assert.equal(rOk.sent, "immediate");
  assert.equal(sent.length, 1);
  assert.match(sent[0], /IG DM/);
}

resetNotifyQueueForTests();
console.log("metaNotify.test.js: ok");
