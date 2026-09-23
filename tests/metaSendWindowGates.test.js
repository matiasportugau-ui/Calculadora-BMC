/**
 * Meta send window and deny-before-fetch gates.
 * Run: node tests/metaSendWindowGates.test.js
 *
 * Happy-path omni tests use a 1h gap and a 2-day gap, so flipping
 * `<= 24h` to `< 24h` would still pass. Exact 24h stays RESPONSE.
 * Missing token or recipient must not call Graph.
 */
import assert from "node:assert/strict";
import { buildMetaMessagePayload, sendMetaMessage } from "../server/lib/omni/outbound/metaSend.js";

const DAY = 24 * 60 * 60 * 1000;
const last = "2026-07-08T10:00:00.000Z";
const exact = new Date(Date.parse(last) + DAY);
const justOver = new Date(Date.parse(last) + DAY + 1);

const inside = buildMetaMessagePayload({
  recipientId: "RID",
  text: "Dentro",
  lastCustomerAt: last,
  now: exact,
});
assert.equal(inside.inWindow, true);
assert.equal(inside.payload.messaging_type, "RESPONSE");
assert.equal(inside.payload.tag, undefined);

const outside = buildMetaMessagePayload({
  recipientId: "RID",
  text: "Fuera",
  lastCustomerAt: last,
  now: justOver,
});
assert.equal(outside.inWindow, false);
assert.equal(outside.payload.messaging_type, "MESSAGE_TAG");
assert.equal(outside.payload.tag, "HUMAN_AGENT");

const custom = buildMetaMessagePayload({
  recipientId: "RID",
  text: "Fuera",
  lastCustomerAt: last,
  now: justOver,
  tag: "CONFIRMED_EVENT_UPDATE",
});
assert.equal(custom.payload.tag, "CONFIRMED_EVENT_UPDATE");

const missingAt = buildMetaMessagePayload({ recipientId: "RID", text: "x", now: exact });
assert.equal(missingAt.inWindow, false);
assert.equal(missingAt.payload.messaging_type, "MESSAGE_TAG");

const badAt = buildMetaMessagePayload({
  recipientId: "RID",
  text: "x",
  lastCustomerAt: "nope",
  now: exact,
});
assert.equal(badAt.inWindow, false);

const clipped = buildMetaMessagePayload({
  recipientId: "RID",
  text: "x".repeat(2001),
  lastCustomerAt: last,
  now: exact,
});
assert.equal(clipped.payload.message.text.length, 2000);

let fetches = 0;
const fetchImpl = async () => {
  fetches += 1;
  return { ok: true, status: 200, json: async () => ({}) };
};

const noToken = await sendMetaMessage({
  pageToken: "",
  recipientId: "RID",
  text: "hi",
  fetchImpl,
});
assert.deepEqual(noToken, { ok: false, error: "meta_page_token_missing" });

const noRecipient = await sendMetaMessage({
  pageToken: "PAGE_TOKEN",
  recipientId: "",
  text: "hi",
  fetchImpl,
});
assert.deepEqual(noRecipient, { ok: false, error: "meta_recipient_missing" });
assert.equal(fetches, 0);

const failed = await sendMetaMessage({
  pageToken: "PAGE_TOKEN",
  recipientId: "RID",
  text: "hi",
  lastCustomerAt: last,
  now: justOver,
  fetchImpl: async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { message: "outside window" } }),
  }),
});
assert.equal(failed.ok, false);
assert.equal(failed.error, "outside window");
assert.equal(failed.status, 400);
assert.equal(failed.inWindow, false);
assert.equal(String(failed.error).includes("PAGE_TOKEN"), false);

const nonJson = await sendMetaMessage({
  pageToken: "PAGE_TOKEN",
  recipientId: "RID",
  text: "hi",
  fetchImpl: async () => ({
    ok: false,
    status: 502,
    json: async () => {
      throw new Error("not json");
    },
  }),
});
assert.equal(nonJson.ok, false);
assert.equal(nonJson.error, "meta_send_failed");
assert.equal(nonJson.status, 502);

console.log("metaSendWindowGates.test.js: ok");
