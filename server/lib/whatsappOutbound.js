/**
 * Envío saliente WhatsApp Business Cloud API (texto).
 * Requiere WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en config.
 *
 * `postWhatsAppMessage` is the SINGLE place that talks to the Graph API. The two
 * public senders are thin adapters over it with their own error contracts:
 *   - sendWhatsAppText — throws on HTTP error, returns raw data (4 callers).
 *   - omni/outbound/waReply.sendWaReply — returns {ok,...} (1 caller).
 */

/**
 * Low-level Graph API send. Does NOT throw on HTTP error — returns the status so
 * each adapter can map it. Throws only on missing phone/config or network/abort.
 * @param {object} opts
 * @param {string} opts.to            destination phone (any format; normalized to digits)
 * @param {string} opts.text
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 * @param {AbortSignal} [opts.signal]  cancelable from the worker on SIGTERM
 * @returns {Promise<{ ok: boolean, status: number, data: object }>}
 */
export async function postWhatsAppMessage({ to, text, accessToken, phoneNumberId, signal }) {
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
  return { ok: res.ok, status: res.status, data };
}

/**
 * @param {object} opts
 * @param {string} opts.to - E.164 sin + o solo dígitos
 * @param {string} opts.text
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 * @param {AbortSignal} [opts.signal] - cancelable desde el worker en SIGTERM
 * @returns {Promise<object>} Graph API response data (throws on HTTP error)
 */
export async function sendWhatsAppText({ to, text, accessToken, phoneNumberId, signal }) {
  const { ok, data } = await postWhatsAppMessage({ to, text, accessToken, phoneNumberId, signal });
  if (!ok) {
    const msg = data?.error?.message || JSON.stringify(data) || "send failed";
    throw new Error(`WhatsApp API: ${msg}`);
  }
  return data;
}
