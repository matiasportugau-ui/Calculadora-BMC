import { sendWhatsAppText } from "./whatsappOutbound.js";
import { getPolicyAllowAuto } from "./omniRepository.js";
import { sendMessengerText, sendInstagramText } from "./metaOutbound.js";

/**
 * @param {import("pg").Pool} pool
 * @param {object} config
 * @param {object} logger
 * @param {{ id: number, channel: string, external_thread_id: string }} thread
 * @param {number} messageId
 * @param {string} consultaTipo
 * @param {string} bodyText
 */
export async function maybeOmniAutoReply(pool, config, logger, thread, messageId, consultaTipo, bodyText) {
  const { rows } = await pool.query(`select mode, human_active_until from omni_threads where id = $1`, [thread.id]);
  const t = rows[0];
  if (!t || t.mode !== "auto") return;

  if (t.human_active_until) {
    const until = new Date(t.human_active_until).getTime();
    if (until > Date.now()) return;
  }

  const allow = await getPolicyAllowAuto(pool, consultaTipo);
  if (!allow) return;

  const text =
    "Gracias por tu mensaje. Registramos tu consulta; un asesor puede completar la respuesta si hace falta.";

  try {
    if (thread.channel === "whatsapp") {
      if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) return;
      await sendWhatsAppText({
        to: thread.external_thread_id,
        text,
        accessToken: config.whatsappAccessToken,
        phoneNumberId: config.whatsappPhoneNumberId,
      });
    } else if (thread.channel === "messenger") {
      if (!config.metaPageAccessToken) return;
      await sendMessengerText({
        accessToken: config.metaPageAccessToken,
        psid: thread.external_thread_id,
        text,
        graphVersion: config.metaGraphVersion,
      });
    } else if (thread.channel === "instagram") {
      const tok = config.metaInstagramAccessToken;
      const ig = config.metaInstagramAccountId;
      if (!tok || !ig) return;
      await sendInstagramText({
        accessToken: tok,
        instagramAccountId: ig,
        igsid: thread.external_thread_id,
        text,
        graphVersion: config.metaGraphVersion,
      });
    }

    const outId = `outbound-auto-${messageId}-${Date.now()}`;
    await pool.query(
      `insert into omni_messages (thread_id, channel, external_message_id, direction, body_text, raw_payload)
       values ($1, $2, $3, 'outbound', $4, '{}'::jsonb)
       on conflict (channel, external_message_id) do nothing`,
      [thread.id, thread.channel, outId, text],
    );
    logger?.info?.({ threadId: thread.id, channel: thread.channel }, "[omni] auto-reply sent");
  } catch (e) {
    logger?.warn?.({ err: e.message, threadId: thread.id }, "[omni] auto-reply failed");
  }
}
