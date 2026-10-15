import assert from "node:assert/strict";
import { formatSlackText, sendSlackText } from "../server/lib/slack/notify.js";

assert.equal(formatSlackText("  hola  "), "hola");
assert.equal(formatSlackText("x".repeat(4005)).length, 3900);

{
  const result = await sendSlackText({ text: "   " });
  assert.equal(result.skipped, "empty_text");
}

{
  const calls = [];
  const result = await sendSlackText({
    text: "Hola Slack",
    webhookUrl: "https://hooks.slack.com/services/T000/B000/XXX",
    botToken: "xoxb-test",
    channel: "#ops",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => "ok" };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.via, "webhook");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hooks.slack.com/services/T000/B000/XXX");
  assert.deepEqual(JSON.parse(calls[0].init.body), { text: "Hola Slack" });
}

{
  const calls = [];
  const result = await sendSlackText({
    text: "Hola canal",
    botToken: "xoxb-test",
    channel: "#meta-inbox",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ ok: true, channel: "#meta-inbox", ts: "1.0" }) };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://slack.com/api/chat.postMessage");
  assert.ok(typeof calls[0].init.headers.Authorization === "string");
  assert.ok(calls[0].init.headers.Authorization.length > 7);
  assert.deepEqual(JSON.parse(calls[0].init.body), { channel: "#meta-inbox", text: "Hola canal" });
}

{
  const result = await sendSlackText({ text: "Hola", botToken: "xoxb-test" });
  assert.equal(result.skipped, "slack_channel_empty");
}

{
  const result = await sendSlackText({ text: "Hola" });
  assert.equal(result.skipped, "slack_not_configured");
}

console.log("slackNotify.test.js: ok");
