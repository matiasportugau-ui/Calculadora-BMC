// Slack send leftovers after tip slackNotify + open #1244 wiring/error pins.
// Webhook whitespace must fall through to bot; webhook still wins with no
// channel; HTTP errors must not embed the webhook path or bot token.
// Run: node tests/slackSendFallthroughGates.test.js

import assert from "node:assert/strict";
import { formatSlackText, sendSlackText } from "../server/lib/slack/notify.js";

assert.equal(formatSlackText(null), "");
assert.equal(formatSlackText(undefined), "");
assert.equal(formatSlackText(0), "");

{
  const calls = [];
  const result = await sendSlackText({
    text: "Hola bot",
    webhookUrl: "   ",
    botToken: "xoxb-test",
    channel: "#meta-inbox",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, ts: "1.0" }) };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://slack.com/api/chat.postMessage");
  assert.equal(JSON.parse(calls[0].init.body).channel, "#meta-inbox");
}

{
  const calls = [];
  const result = await sendSlackText({
    text: "Hola webhook",
    webhookUrl: "https://hooks.slack.com/services/T000/B000/SECRETPATH",
    botToken: "xoxb-unused",
    channel: "",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => "ok" };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.via, "webhook");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hooks.slack.com/services/T000/B000/SECRETPATH");
}

{
  const webhook = "https://hooks.slack.com/services/T000/B000/SECRETPATH";
  await assert.rejects(
    () =>
      sendSlackText({
        text: "hola",
        webhookUrl: webhook,
        fetchImpl: async () => ({ ok: false, status: 502, text: async () => "nope" }),
      }),
    (err) => {
      const msg = String(err.message);
      assert.match(msg, /Slack webhook: HTTP 502/);
      assert.equal(msg.includes("SECRETPATH"), false, "webhook path stays out of the throw");
      assert.equal(msg.includes(webhook), false, "full webhook URL stays out of the throw");
      return true;
    },
  );
}

{
  const secretToken = "xoxb-secret-should-not-leak";
  await assert.rejects(
    () =>
      sendSlackText({
        text: "hola",
        botToken: `  ${secretToken}  `,
        channel: "  #meta-inbox  ",
        fetchImpl: async (url, init) => {
          assert.equal(url, "https://slack.com/api/chat.postMessage");
          assert.equal(init.headers.Authorization, `Bearer ${secretToken}`);
          assert.equal(JSON.parse(init.body).channel, "#meta-inbox");
          return {
            ok: false,
            status: 500,
            json: async () => ({ ok: false, error: "fatal_error" }),
          };
        },
      }),
    (err) => {
      const msg = String(err.message);
      assert.match(msg, /Slack API: fatal_error/);
      assert.equal(msg.includes(secretToken), false);
      return true;
    },
  );
}

console.log("slackSendFallthroughGates.test.js: ok");
