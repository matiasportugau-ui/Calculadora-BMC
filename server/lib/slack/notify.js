export function formatSlackText(text) {
  return String(text || "").trim().slice(0, 3900);
}

export async function sendSlackText({
  text,
  webhookUrl,
  botToken,
  channel,
  fetchImpl = fetch,
} = {}) {
  const bodyText = formatSlackText(text);
  if (!bodyText) return { skipped: "empty_text" };

  const webhook = String(webhookUrl || "").trim();
  if (webhook) {
    const res = await fetchImpl(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: bodyText }),
    });
    const responseText = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Slack webhook: HTTP ${res.status}${responseText ? ` ${responseText}` : ""}`);
    return { ok: true, via: "webhook" };
  }

  const token = String(botToken || "").trim();
  if (!token) return { skipped: "slack_not_configured" };

  const targetChannel = String(channel || "").trim();
  if (!targetChannel) return { skipped: "slack_channel_empty" };

  const res = await fetchImpl("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: targetChannel, text: bodyText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(`Slack API: ${data?.error || `HTTP ${res.status}`}`);
  }
  return data;
}
