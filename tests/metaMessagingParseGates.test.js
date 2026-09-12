// Meta IG/FB adapter parse gates — leftover from #1229 / #1239.
// Tip omniMetaChannels / metaNotify only pin a happy-path DM sample.
// Run: node tests/metaMessagingParseGates.test.js

import assert from "node:assert/strict";
import { igWebhookToOmniEvents } from "../server/lib/omni/adapters/igWebhook.js";
import { messengerWebhookToOmniEvents } from "../server/lib/omni/adapters/messengerWebhook.js";
import { createNotifyQueue } from "../server/lib/meta/notify.js";

function messagingBody(items, object = "page") {
  return {
    object,
    entry: [{ id: "page_1", messaging: items }],
  };
}

function dm({ senderId, mid, text, extra = {}, sender = { id: senderId, name: "Ana" } }) {
  return {
    sender,
    recipient: { id: "page_1" },
    timestamp: 1_783_515_000,
    message: { mid, text, ...extra },
  };
}

{
  const events = igWebhookToOmniEvents(
    messagingBody([dm({ senderId: "IGSID_1", mid: "ig_mid_1", text: "Hola IG" })]),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].channel, "ig");
  assert.equal(events[0].source, "ig_webhook");
  assert.equal(events[0].idempotency_key, "ig:msg:ig_mid_1");
  assert.equal(events[0].contact_hint.igsid, "IGSID_1");
  assert.equal(events[0].contact_hint.psid, undefined);
  assert.equal(events[0].message.metadata.is_echo, false);
  assert.equal(events[0].message.metadata.type, "message");
}

{
  const events = messengerWebhookToOmniEvents(
    messagingBody([dm({ senderId: "PSID_1", mid: "fb_mid_1", text: "Hola FB" })]),
  );
  assert.equal(events[0].channel, "fb");
  assert.equal(events[0].contact_hint.psid, "PSID_1");
  assert.equal(events[0].contact_hint.igsid, undefined);
  assert.equal(events[0].idempotency_key, "fb:msg:fb_mid_1");
}

// Missing sender.id / whitespace-only text / delivery receipts never become Omni events
{
  const events = messengerWebhookToOmniEvents(
    messagingBody([
      { recipient: { id: "page_1" }, message: { mid: "no_sender", text: "hola" } },
      dm({ senderId: "PSID_2", mid: "blank", text: "   " }),
      {
        sender: { id: "PSID_3" },
        recipient: { id: "page_1" },
        timestamp: 1_783_515_000,
        delivery: { mids: ["delivered_1"], watermark: 1_783_515_000 },
      },
      {
        sender: { id: "PSID_4" },
        recipient: { id: "page_1" },
        timestamp: 1_783_515_000,
        read: { mid: "read_1", watermark: 1_783_515_000 },
      },
    ]),
  );
  assert.equal(events.length, 0);
}

// Instagram `entry.changes` comments are ignored (META_COMMENTS_ENABLED stays off)
{
  const events = igWebhookToOmniEvents({
    object: "instagram",
    entry: [
      {
        id: "ig_1",
        changes: [
          {
            field: "comments",
            value: {
              id: "c1",
              text: "Cuánto sale el de 2.60?",
              from: { id: "IGSID_C", username: "maria" },
            },
          },
        ],
      },
    ],
  });
  assert.equal(events.length, 0);
}

// Attachment-only → placeholder body (so persist still has message.body min 1)
{
  const events = igWebhookToOmniEvents(
    messagingBody([
      dm({
        senderId: "IGSID_A",
        mid: "att_1",
        text: undefined,
        extra: { attachments: [{ type: "image", payload: { url: "https://cdn.example/x.jpg" } }] },
      }),
    ]),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].message.body, "[attachment]");
  assert.equal(events[0].message.attachments.length, 1);
}

// Postback title wins over payload; referral.ref is a body
{
  const events = messengerWebhookToOmniEvents(
    messagingBody([
      {
        sender: { id: "PSID_P", name: "Luis" },
        recipient: { id: "page_1" },
        timestamp: 1_783_515_000,
        postback: { title: "Ver precio", payload: "PRICE_PAYLOAD", mid: "pb_1" },
      },
      {
        sender: { id: "PSID_R" },
        recipient: { id: "page_1" },
        timestamp: 1_783_515_000,
        referral: { ref: "ad_campaign_99" },
      },
    ]),
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].message.body, "Ver precio");
  assert.equal(events[0].message.metadata.type, "postback");
  assert.equal(events[0].idempotency_key, "fb:msg:pb_1");
  assert.equal(events[1].message.body, "ad_campaign_99");
}

// Unix seconds vs ms — seconds must be scaled, ms must not be scaled again
{
  const sec = 1_783_515_000;
  const ms = sec * 1000;
  const fromSec = messengerWebhookToOmniEvents(
    messagingBody([{ ...dm({ senderId: "PSID_T", mid: "t_sec", text: "sec" }), timestamp: sec }]),
  );
  const fromMs = messengerWebhookToOmniEvents(
    messagingBody([{ ...dm({ senderId: "PSID_T", mid: "t_ms", text: "ms" }), timestamp: ms }]),
  );
  assert.equal(fromSec[0].occurred_at, new Date(ms).toISOString());
  assert.equal(fromMs[0].occurred_at, new Date(ms).toISOString());
}

// Sender name fallbacks: profile.name then first_name
{
  const named = igWebhookToOmniEvents(
    messagingBody([
      dm({
        senderId: "IGSID_N",
        mid: "n1",
        text: "hola",
        sender: { id: "IGSID_N", profile: { name: "María Perfil" } },
      }),
    ]),
  );
  assert.equal(named[0].contact_hint.name, "María Perfil");

  const first = igWebhookToOmniEvents(
    messagingBody([
      dm({
        senderId: "IGSID_F",
        mid: "n2",
        text: "hola",
        sender: { id: "IGSID_F", profile: { first_name: "Sofía" } },
      }),
    ]),
  );
  assert.equal(first[0].contact_hint.name, "Sofía");
}

// Echo from Graph `message.is_echo` must reach notify skip (owner replies)
{
  const events = igWebhookToOmniEvents(
    messagingBody([
      dm({
        senderId: "IGSID_ECHO",
        mid: "echo_1",
        text: "nuestro reply",
        extra: { is_echo: true },
      }),
    ]),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].message.metadata.is_echo, true);
  assert.equal(events[0].message.body, "nuestro reply");

  const sent = [];
  const q = createNotifyQueue({
    getOwnerWhatsapp: () => "59899111222",
    send: async (text) => sent.push(text),
    now: () => 1_000,
  });
  const r = await q.notifyOwner({ event: events[0], n: 1 });
  assert.equal(r.skipped, "echo");
  assert.equal(sent.length, 0);
}

// Two messaging items in one entry → two events; non-array messaging is empty
{
  const two = igWebhookToOmniEvents(
    messagingBody([
      dm({ senderId: "IGSID_1", mid: "m1", text: "uno" }),
      dm({ senderId: "IGSID_2", mid: "m2", text: "dos" }),
    ]),
  );
  assert.equal(two.length, 2);
  assert.deepEqual(
    two.map((e) => e.idempotency_key),
    ["ig:msg:m1", "ig:msg:m2"],
  );

  const empty = igWebhookToOmniEvents({ object: "page", entry: [{ id: "page_1", messaging: "nope" }] });
  assert.equal(empty.length, 0);
}

console.log("metaMessagingParseGates.test.js: ok");
