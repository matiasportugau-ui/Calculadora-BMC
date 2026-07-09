// ML webhook → Omni adapter/service offline tests
// node tests/mlWebhookOmni.test.js
import { extractMlWebhookResourceId, mlWebhookToOmniEvent } from "../server/lib/omni/adapters/mlWebhook.js";
import { createMlWebhookProcessor } from "../server/lib/mlWebhookService.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

const notification = {
  topic: "questions",
  resource: "/questions/12345",
  user_id: 999,
  sent: "2026-07-08T12:00:00.000Z",
};
const question = {
  id: 12345,
  text: "Hola, ¿tienen envío a Maldonado?",
  from: { id: 7711 },
  item_id: "MLU111",
  date_created: "2026-07-08T11:59:00.000Z",
  status: "UNANSWERED",
};


const parseCases = [
  [{ resource: "/questions/12345///?foo=bar" }, "12345"],
  [{ resource: "messages/packs/555/sellers/999///" }, "messages/packs/555/sellers/999"],
  [{ id: "abc-123///" }, "abc-123"],
];
for (const [input, expected] of parseCases) {
  assert(`resource id parser keeps legacy behavior for ${expected}`, extractMlWebhookResourceId(input) === expected);
}

const adversarial = `${"/".repeat(120_000)}questions/slow-resource${"/".repeat(120_000)}?ignored=${"/".repeat(120_000)}`;
const t0 = Date.now();
const adversarialId = extractMlWebhookResourceId({ resource: adversarial });
const elapsedMs = Date.now() - t0;
assert("resource id parser handles long slash-heavy payload", adversarialId === "slow-resource");
assert("resource id parser stays fast on adversarial payload", elapsedMs < 250);

const event = mlWebhookToOmniEvent({ notification, resourcePayload: question });
assert("question maps to ml channel", event?.channel === "ml" && event.source === "ml_webhook");
assert("question idempotency uses resource id", event?.idempotency_key === "ml:msg:12345");
assert("question maps contact_hint.ml_user_id", event?.contact_hint?.ml_user_id === 7711);
assert("question maps conversation hint by question", event?.conversation_hint?.channel_conversation_id === "12345");
assert("question body preserved", event?.message?.body === question.text);

const messageEvent = mlWebhookToOmniEvent({
  notification: { topic: "messages", resource: "/messages/packs/555/sellers/999" },
  resourcePayload: {
    messages: [{ id: "m1", text: "Ya compré, coordinamos entrega?", from: { user_id: 8822 }, order_id: 444 }],
  },
});
assert("post-sale message maps to ml channel", messageEvent?.channel === "ml");
assert("post-sale conversation prefers order id", messageEvent?.conversation_hint?.channel_conversation_id === "444");
assert("post-sale idempotency uses notification resource", messageEvent?.idempotency_key === "ml:msg:messages/packs/555/sellers/999");

await (async () => {
  const persisted = new Map();
  const processor = createMlWebhookProcessor({
    ml: {},
    config: { omniMlShadowWrite: true, databaseUrl: "postgres://offline" },
    fetchResource: async () => question,
    persistOmni: async (omniEvent) => {
      if (persisted.has(omniEvent.idempotency_key)) {
        return { duplicate: true, message_id: persisted.get(omniEvent.idempotency_key) };
      }
      persisted.set(omniEvent.idempotency_key, "msg-1");
      return { duplicate: false, message_id: "msg-1" };
    },
  });
  const first = await processor.processNotification({ body: notification, headers: {} });
  const second = await processor.processNotification({ body: notification, headers: {} });
  assert("redelivery returns duplicate from idempotency key", first.omni?.duplicate === false && second.omni?.duplicate === true);
  assert("redelivery persisted one unique resource", persisted.size === 1);
})();

await (async () => {
  let autoCalls = 0;
  const processor = createMlWebhookProcessor({
    ml: {},
    config: { bmcSheetId: "sheet-1", omniMlShadowWrite: false },
    syncMLCRM: async () => ({ rows: [{ questionId: "12345", rowNum: 10, questionText: "x", itemTitle: "y", nickname: "n" }] }),
    autoAnswerPipeline: async ({ rows }) => {
      autoCalls += 1;
      return { answered: rows.length };
    },
  });
  await processor.processNotification({ body: notification, headers: {}, autoMode: { fullAuto: true } });
  await processor.processNotification({ body: notification, headers: {}, autoMode: { fullAuto: true } });
  assert("redelivery does not double-run auto-answer", autoCalls === 1);
})();

console.log(`\nmlWebhookOmni (offline): ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
