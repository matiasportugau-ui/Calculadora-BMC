/**
 * Omni outbound — WhatsApp reply via Cloud API.
 * Thin adapter over the single Graph sender (lib/whatsappOutbound.postWhatsAppMessage):
 * applies the UY E.164 (598…) normalization and returns the {ok,...} shape the omni
 * reply route expects.
 */
import { postWhatsAppMessage } from "../../whatsappOutbound.js";

/**
 * @param {{ config: object; toPhone: string; text: string }} args
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, status?: number }>}
 */
export async function sendWaReply({ config, toPhone, text }) {
  const accessToken = config.whatsappAccessToken;
  const phoneNumberId = config.whatsappPhoneNumberId;
  if (!accessToken || !phoneNumberId) {
    return { ok: false, error: "whatsapp_not_configured" };
  }

  const digits = String(toPhone || "").replace(/\D/g, "");
  const to = digits.startsWith("598") ? digits : `598${digits.replace(/^0+/, "")}`;

  try {
    const { ok, status, data } = await postWhatsAppMessage({ to, text, accessToken, phoneNumberId });
    if (!ok) {
      return { ok: false, error: data?.error?.message || "wa_send_failed", status, data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.message || "wa_send_failed" };
  }
}
