// Offline. No Mercado Libre, no Sheets.
// node tests/mlWebhookFetchGates.test.js
import assert from "node:assert/strict";
import {
  buildMlWebhookEvent,
  createMlWebhookBuffer,
  createMlWebhookProcessor,
  defaultFetchMlWebhookResource,
  mlWebhookTopic,
} from "../server/lib/mlWebhookService.js";

function mlSpy() {
  const calls = [];
  return {
    calls,
    async requestWithRetries(args) {
      calls.push(args);
      return { ok: true, path: args.path };
    },
  };
}

{
  const ml = mlSpy();
  const fetched = await defaultFetchMlWebhookResource({
    ml,
    notification: { resource: "  /questions/9?foo=1  " },
    topic: "questions",
  });
  assert.equal(ml.calls.length, 1);
  assert.equal(ml.calls[0].method, "GET");
  assert.equal(ml.calls[0].path, "/questions/9?foo=1");
  assert.equal(fetched.path, "/questions/9?foo=1");
}

{
  const ml = mlSpy();
  const fetched = await defaultFetchMlWebhookResource({
    ml,
    notification: { resource: "questions/42/" },
    topic: "questions",
  });
  assert.deepEqual(ml.calls, [{ method: "GET", path: "/questions/42" }]);
  assert.equal(fetched.path, "/questions/42");
}

{
  const ml = mlSpy();
  const fromId = await defaultFetchMlWebhookResource({
    ml,
    notification: { id: "77" },
    topic: "questions",
  });
  assert.equal(fromId.path, "/questions/77");
}

{
  const ml = mlSpy();
  const missed = await defaultFetchMlWebhookResource({
    ml,
    notification: { resource: "messages/packs/1/sellers/2" },
    topic: "messages",
  });
  assert.equal(missed, null);
  assert.equal(ml.calls.length, 0);
}

{
  const ml = mlSpy();
  const posted = await defaultFetchMlWebhookResource({
    ml,
    notification: { resource: "/messages/packs/1/sellers/2" },
    topic: "messages",
  });
  assert.equal(posted.path, "/messages/packs/1/sellers/2");
  assert.equal(ml.calls.length, 1);
}

{
  const ml = mlSpy();
  const empty = await defaultFetchMlWebhookResource({ ml, notification: {}, topic: "questions" });
  assert.equal(empty, null);
  assert.equal(ml.calls.length, 0);
}

assert.equal(mlWebhookTopic({ body: { topic: " Questions " } }), "questions");
assert.equal(mlWebhookTopic({ body: { topic: "" }, headers: { "x-topic": "MESSAGES" } }), "messages");
assert.equal(mlWebhookTopic({ headers: { topic: "orders" } }), "orders");
assert.equal(
  mlWebhookTopic({ body: { topic: "messages" }, headers: { "x-topic": "questions" } }),
  "messages",
);
assert.equal(
  mlWebhookTopic({ headers: { "x-topic": "messages", topic: "questions" } }),
  "messages",
);
assert.equal(mlWebhookTopic(), "");

{
  const buffer = createMlWebhookBuffer(2);
  buffer.push({ id: "a" });
  buffer.push({ id: "b" });
  buffer.push({ id: "c" });
  assert.deepEqual(buffer.list().map((event) => event.id), ["c", "b"]);
  assert.equal(buffer.count(), 2);
}

{
  const buffer = createMlWebhookBuffer();
  for (let i = 0; i < 251; i += 1) buffer.push({ id: i });
  assert.equal(buffer.count(), 250);
  assert.equal(buffer.list()[0].id, 250);
  assert.equal(buffer.list().at(-1).id, 1);
}

{
  const event = buildMlWebhookEvent({
    body: { topic: "questions", secret: "stays-on-body" },
    query: { id: "1", verify_token: "query-token" },
    headers: {
      "x-request-id": "req-9",
      "x-topic": "questions",
      "x-signature": "ts=1,v1=ab",
      authorization: "Bearer secret",
      cookie: "sid=secret",
      "x-webhook-token": "header-token",
    },
  });
  assert.deepEqual(event.headers, {
    "x-request-id": "req-9",
    topic: "questions",
    "x-signature": "ts=1,v1=ab",
  });
  assert.equal(event.body.secret, "stays-on-body");
  assert.equal(event.query.verify_token, "query-token");
  assert.equal("authorization" in event.headers, false);
  assert.equal("cookie" in event.headers, false);
  assert.equal("x-webhook-token" in event.headers, false);
}

{
  let fetches = 0;
  let syncs = 0;
  let persists = 0;
  let sheets = 0;
  const skipped = await createMlWebhookProcessor({
    ml: {},
    config: { adminInboundRows: true, bmcSheetId: "sheet-1", omniMlShadowWrite: true },
    fetchResource: async () => { fetches += 1; return { text: "hola" }; },
    syncMLCRM: async () => { syncs += 1; return { rows: [] }; },
    persistOmni: async () => { persists += 1; return { duplicate: false }; },
    getSheets: async () => { sheets += 1; throw new Error("sheets"); },
  }).processNotification({
    body: {},
    headers: { "x-topic": "orders" },
  });
  assert.deepEqual(skipped, { ok: true, skipped: "unsupported_topic", topic: "orders" });
  assert.equal(fetches + syncs + persists + sheets, 0);
}

{
  let topicSeen = "";
  const result = await createMlWebhookProcessor({
    ml: {},
    config: { omniMlShadowWrite: false, bmcSheetId: "sheet-1" },
    syncMLCRM: async (_args) => {
      topicSeen = "called";
      return { synced: 1, rows: [] };
    },
  }).processNotification({
    body: {},
    headers: { "x-topic": " Questions " },
  });
  assert.equal(result.ok, true);
  assert.equal(result.topic, "questions");
  assert.equal(result.skipped, undefined);
  assert.equal(topicSeen, "called");
  assert.equal(result.resourceId, "");
}

console.log("mlWebhookFetchGates OK");
