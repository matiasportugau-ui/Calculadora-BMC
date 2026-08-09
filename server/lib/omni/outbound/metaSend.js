export function isWithin24h(lastCustomerAt, now = new Date()) {
  if (!lastCustomerAt) return false;
  const t = new Date(lastCustomerAt).getTime();
  const n = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Number.isFinite(t) && Number.isFinite(n) && n - t <= 24 * 60 * 60 * 1000;
}

export function buildMetaMessagePayload({ recipientId, text, lastCustomerAt, tag, now }) {
  const inWindow = isWithin24h(lastCustomerAt, now);
  const payload = {
    recipient: { id: String(recipientId || "") },
    message: { text: String(text || "").slice(0, 2000) },
    messaging_type: inWindow ? "RESPONSE" : "MESSAGE_TAG",
  };
  if (!inWindow) payload.tag = tag || "HUMAN_AGENT";
  return { payload, inWindow };
}

export async function sendMetaMessage({ pageToken, recipientId, text, lastCustomerAt, tag, fetchImpl = fetch, graphApiVersion = "v21.0", now }) {
  if (!pageToken) return { ok: false, error: "meta_page_token_missing" };
  if (!recipientId) return { ok: false, error: "meta_recipient_missing" };
  const { payload, inWindow } = buildMetaMessagePayload({ recipientId, text, lastCustomerAt, tag, now });
  const res = await fetchImpl(`https://graph.facebook.com/${graphApiVersion}/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error?.message || "meta_send_failed", status: res.status, data, payload, inWindow };
  return { ok: true, data, payload, inWindow };
}
