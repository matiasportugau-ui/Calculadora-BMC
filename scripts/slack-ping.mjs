#!/usr/bin/env node

import { config } from "../server/config.js";
import { sendSlackText } from "../server/lib/slack/notify.js";

try {
  const result = await sendSlackText({
    text: "BMC ping — Slack app install OK",
    webhookUrl: config.slackWebhookUrl,
    botToken: config.slackBotToken,
    channel: config.slackNotifyChannel,
  });

  if (result?.skipped) {
    console.error(result.skipped);
    process.exit(2);
  }

  console.log("slack-ping: ok");
} catch (err) {
  console.error(`slack-ping: ${err?.message || err}`);
  process.exit(1);
}
