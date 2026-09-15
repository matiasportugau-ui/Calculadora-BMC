// Slack bot leftovers after tip slackNotify + open #1244/#1251.
// #1244 pins HTTP 200 + {ok:false, error}. #1251 pins HTTP 500 + secret omit.
// This file pins invalid/empty JSON vs res.ok, and webhook text() reject.
// Run: node tests/slackBotJsonStatusGates.test.js

import assert from "node:assert/strict";
import { sendSlackText } from "../server/lib/slack/notify.js";

{
  const result = await sendSlackText({
    text: "hola",
    botToken: "xoxb-test",
    channel: "#meta-inbox",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    }),
  });
  assert.deepEqual(result, {}, "HTTP 200 + json() throw currently returns {} (pin, do not treat as Slack ok:true)");
}

{
  await assert.rejects(
    () =>
      sendSlackText({
        text: "hola",
        botToken: "xoxb-test",
        channel: "#meta-inbox",
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          json: async () => {
            throw new Error("not json");
          },
        }),
      }),
    (err) => {
      assert.equal(String(err.message), "Slack API: HTTP 401");
      return true;
    },
  );
}

{
  await assert.rejects(
    () =>
      sendSlackText({
        text: "hola",
        botToken: "xoxb-test",
        channel: "#meta-inbox",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ ok: false }),
        }),
      }),
    (err) => {
      assert.equal(String(err.message), "Slack API: HTTP 200");
      return true;
    },
  );
}

{
  await assert.rejects(
    () =>
      sendSlackText({
        text: "hola",
        webhookUrl: "https://hooks.slack.com/services/T000/B000/SECRETPATH",
        fetchImpl: async () => ({
          ok: false,
          status: 502,
          text: async () => {
            throw new Error("body unreadable");
          },
        }),
      }),
    (err) => {
      assert.equal(String(err.message), "Slack webhook: HTTP 502");
      assert.equal(String(err.message).includes("SECRETPATH"), false);
      assert.equal(String(err.message).includes("body unreadable"), false);
      return true;
    },
  );
}

console.log("slackBotJsonStatusGates.test.js: ok");
