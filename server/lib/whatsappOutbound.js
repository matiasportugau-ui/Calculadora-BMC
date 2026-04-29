/**
 * Envío saliente WhatsApp Business Cloud API (texto).
 * Requiere WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en config.
 */

/**
 * @param {object} opts
 * @param {string} opts.to - E.164 sin + o solo dígitos
 * @param {string} opts.text
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 */
export async function sendWhatsAppText({ to, text, accessToken, phoneNumberId }) {
  const digits = String(to || "").replace(/\D/g, "");
  if (!digits) throw new Error("Missing destination phone");
  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp not configured");

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: digits,
    type: "text",
    text: { body: String(text || "").slice(0, 4096) },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data) || res.statusText;
    throw new Error(`WhatsApp API: ${msg}`);
  }
  return data;
}
