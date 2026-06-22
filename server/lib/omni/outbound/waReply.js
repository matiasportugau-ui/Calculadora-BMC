/**
 * Omni outbound — WhatsApp reply via Cloud API
 */

/**
 * @param {{ config: object; toPhone: string; text: string }} args
 */
export async function sendWaReply({ config, toPhone, text }) {
  const token = config.whatsappAccessToken;
  const phoneNumberId = config.whatsappPhoneNumberId;
  if (!token || !phoneNumberId) {
    return { ok: false, error: "whatsapp_not_configured" };
  }

  const digits = String(toPhone || "").replace(/\D/g, "");
  const to = digits.startsWith("598") ? digits : `598${digits.replace(/^0+/, "")}`;

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: String(text).slice(0, 4096) },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error?.message || "wa_send_failed", status: res.status, data };
  }
  return { ok: true, data };
}
