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
 * @param {AbortSignal} [opts.signal] - cancelable desde el worker en SIGTERM
 */
export async function sendWhatsAppText({ to, text, accessToken, phoneNumberId, signal }) {
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
  // Combina el timeout interno con la señal del caller (shutdown). Cualquiera
  // de los dos aborta el fetch. AbortSignal.any disponible en Node 20+.
  const fetchSignal = signal
    ? AbortSignal.any([AbortSignal.timeout(15000), signal])
    : AbortSignal.timeout(15000);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: fetchSignal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data) || res.statusText;
    throw new Error(`WhatsApp API: ${msg}`);
  }
  return data;
}
