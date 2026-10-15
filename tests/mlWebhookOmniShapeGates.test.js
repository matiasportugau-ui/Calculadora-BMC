// Offline shape pins for the Mercado Libre → Omni adapter.
// node tests/mlWebhookOmniShapeGates.test.js
import assert from "node:assert/strict";
import { mlWebhookToOmniEvent } from "../server/lib/omni/adapters/mlWebhook.js";

const baseNote = {
  topic: "questions",
  resource: "/questions/12345",
  sent: "2026-07-08T12:00:00.000Z",
};

assert.equal(mlWebhookToOmniEvent({
  notification: { ...baseNote, topic: "orders" },
  resourcePayload: { text: "hola" },
}), null);

assert.equal(mlWebhookToOmniEvent({
  notification: { topic: "questions" },
  resourcePayload: { text: "hola" },
}), null);

assert.equal(mlWebhookToOmniEvent({
  notification: baseNote,
  resourcePayload: { text: "   ", question: { text: "  " } },
}), null);

assert.equal(mlWebhookToOmniEvent({
  notification: baseNote,
  resourcePayload: { text: 12 },
}), null);

{
  const event = mlWebhookToOmniEvent({
    notification: baseNote,
    resourcePayload: { text: "", question: { text: "  nested  " }, id: 999, from: { id: 0, nickname: "paneles.uy" } },
  });
  assert.equal(event.message.body, "nested");
  assert.equal(event.contact_hint.name, "ML#0");
  assert.equal(event.contact_hint.ml_user_id, 0);
  assert.equal(event.message.sender_id, "0");
  assert.equal(event.idempotency_key, "ml:msg:12345");
  assert.equal(event.conversation_hint.channel_conversation_id, "999");
  assert.equal(event.contact_hint.name.includes("paneles"), false);
}

{
  const event = mlWebhookToOmniEvent({
    notification: baseNote,
    resourcePayload: { text: "  hola  ", item: { id: "MLU9" } },
  });
  assert.equal(event.message.body, "hola");
  assert.equal(event.contact_hint.name, undefined);
  assert.equal(event.contact_hint.ml_user_id, undefined);
  assert.equal(event.message.sender_id, undefined);
  assert.equal(event.message.metadata.item_id, "MLU9");
  assert.equal(event.message.metadata.status, null);
  assert.equal(event.conversation_hint.subject, "ML item MLU9");
}

{
  const event = mlWebhookToOmniEvent({
    notification: { topic: "messages", resource: "questions/should-not-win" },
    resourcePayload: { text: "from-arg" },
    topic: " Questions ",
  });
  assert.equal(event.message.metadata.ml_topic, "questions");
  assert.equal(event.message.body, "from-arg");
  assert.equal(event.idempotency_key, "ml:msg:should-not-win");
}

{
  const event = mlWebhookToOmniEvent({
    notification: { topic: "messages", resource: "/messages/packs/555/sellers/999" },
    resourcePayload: {
      messages: [{ id: "m1", text: "primero", from: { user_id: 8 }, order_id: 0, pack_id: "P9" }],
      results: [{ text: "decoy", from: { user_id: 1 }, order_id: 444 }],
    },
  });
  assert.equal(event.message.body, "primero");
  assert.equal(event.contact_hint.ml_user_id, 8);
  assert.equal(event.conversation_hint.channel_conversation_id, "P9");
  assert.equal(event.conversation_hint.subject, "ML pack P9");
  assert.equal(event.message.metadata.order_id, null);
  assert.equal(event.message.metadata.pack_id, "P9");
}

{
  const event = mlWebhookToOmniEvent({
    notification: { topic: "messages", resource: "/messages/packs/1" },
    resourcePayload: {
      messages: [],
      results: [{ content: { text: "  desde results  " }, sender: { id: 3 } }],
    },
  });
  assert.equal(event.message.body, "desde results");
  assert.equal(event.contact_hint.name, "ML#3");
  assert.equal(event.conversation_hint.channel_conversation_id, "messages/packs/1");
  assert.equal(event.conversation_hint.subject, "ML messages/packs/1");
  assert.equal(event.idempotency_key, "ml:msg:messages/packs/1");
}

assert.equal(mlWebhookToOmniEvent({
  notification: { topic: "messages", resource: "/messages/packs/1" },
  resourcePayload: { messages: [{ text: 5 }, { text: "segundo" }] },
}), null);

{
  const longId = "q".repeat(500);
  const event = mlWebhookToOmniEvent({
    notification: { topic: "questions", resource: `/questions/${longId}` },
    resourcePayload: { text: "hola", id: longId },
  });
  assert.equal(event.idempotency_key, `ml:msg:${"q".repeat(480)}`);
  assert.equal(event.conversation_hint.channel_conversation_id, longId);
}

console.log("mlWebhookOmniShapeGates OK");
