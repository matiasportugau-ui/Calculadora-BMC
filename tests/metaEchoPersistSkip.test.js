// Meta IG/FB Graph echoes must not persist as Omni customer messages.
// Run: node tests/metaEchoPersistSkip.test.js

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handleMetaMessagingWebhook } from "../server/lib/omni/metaWebhookHandler.js";
import { igWebhookToOmniEvents } from "../server/lib/omni/adapters/igWebhook.js";

function signed(body, secret = "secret") {
  const rawBodyBuffer = Buffer.from(JSON.stringify(body));
  const signatureHeader =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBodyBuffer).digest("hex");
  return { rawBodyBuffer, signatureHeader, secret };
}

const mixedBatch = {
  object: "instagram",
  entry: [
    {
      id: "PAGE",
      messaging: [
        {
          sender: { id: "PAGE_ID" },
          recipient: { id: "USER_IGSID" },
          timestamp: 1_690_000_000,
          message: { mid: "m_echo_1", text: "Respuesta del owner", is_echo: true },
        },
        {
          sender: { id: "USER_IGSID", name: "Cliente" },
          recipient: { id: "PAGE_ID" },
          timestamp: 1_690_000_001,
          message: { mid: "m_real_1", text: "Hola quiero cotizar" },
        },
      ],
    },
  ],
};

// Adapter still shapes echoes (metadata.is_echo) so callers can decide.
{
  const events = igWebhookToOmniEvents(mixedBatch);
  assert.equal(events.length, 2);
  const echo = events.find((e) => e.message?.metadata?.is_echo);
  assert.ok(echo);
  assert.equal(echo.message.sender, "customer"); // shaped wrong — handler must drop
  assert.equal(echo.message.sender_id, "PAGE_ID");
}

// Handler skips echo persist + notify; keeps real DM.
{
  const persisted = [];
  const notified = [];
  const { rawBodyBuffer, signatureHeader, secret } = signed(mixedBatch);
  const ack = handleMetaMessagingWebhook({
    channel: "ig",
    enabled: true,
    appSecret: secret,
    rawBodyBuffer,
    signatureHeader,
    config: { databaseUrl: "postgres://unused" },
    persist: async (event) => {
      persisted.push({
        mid: event.message?.metadata?.ig_message_id,
        body: event.message?.body,
        is_echo: event.message?.metadata?.is_echo,
        sender: event.message?.sender,
      });
      return { ok: true, duplicate: false };
    },
    notifyOwner: async ({ event }) => {
      notified.push(event.message?.metadata?.ig_message_id);
      return { sent: "immediate" };
    },
  });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.events, 2);
  const results = await ack.processing;
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].mid, "m_real_1");
  assert.equal(persisted[0].is_echo, false);
  assert.equal(notified.length, 1);
  assert.equal(notified[0], "m_real_1");
  assert.ok(results.some((r) => r?.skipped === "echo"));
}

// Echo-only webhook: ack 200, zero persist/notify.
{
  const echoOnly = {
    object: "page",
    entry: [
      {
        id: "page_1",
        messaging: [
          {
            sender: { id: "PAGE" },
            recipient: { id: "PSID" },
            timestamp: 1_690_000_002,
            message: { mid: "fb_echo", text: "Desde Messenger", is_echo: true },
          },
        ],
      },
    ],
  };
  let persistCalls = 0;
  let notifyCalls = 0;
  const { rawBodyBuffer, signatureHeader, secret } = signed(echoOnly);
  const ack = handleMetaMessagingWebhook({
    channel: "fb",
    enabled: true,
    appSecret: secret,
    rawBodyBuffer,
    signatureHeader,
    config: {},
    persist: async () => {
      persistCalls += 1;
      return { ok: true };
    },
    notifyOwner: async () => {
      notifyCalls += 1;
      return {};
    },
  });
  assert.equal(ack.status, 200);
  await ack.processing;
  assert.equal(persistCalls, 0);
  assert.equal(notifyCalls, 0);
}

console.log("metaEchoPersistSkip.test.js: ok");
