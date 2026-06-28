/**
 * Omni outbound — email reply via the shared sendEmailReply (Gmail API preferred,
 * per-casilla SMTP fallback). Mirrors waReply.js / mlReply.js: returns { ok, ... }.
 *
 * `account` is the box that received the original mail (stored on the inbound
 * message's metadata at ingest); it doubles as the From identity so the reply
 * goes out as e.g. ventas@bmcuruguay.com.uy when that alias is verified on the
 * Gmail account, else Gmail stamps the authenticated account address.
 */
import { sendEmailReply } from "../../emailReply.js";

/**
 * @param {{ config:object, to:string, subject?:string, text:string,
 *           inReplyTo?:string, account?:string,
 *           env?:object, sendRaw?:Function, sendMail?:Function }} args
 */
export async function sendOmniEmailReply(args) {
  const { config, to, subject, text, inReplyTo, account } = args || {};
  if (!to) return { ok: false, error: "email_no_recipient" };
  try {
    const data = await sendEmailReply({
      account: account || config?.emailReplyDefaultCasilla,
      from: account || config?.gmailSendFrom || undefined,
      to,
      subject: subject || "Re:",
      text: String(text || ""),
      inReplyTo: inReplyTo || undefined,
      // test injection passthroughs (no-ops in prod)
      env: args.env,
      sendRaw: args.sendRaw,
      sendMail: args.sendMail,
    });
    return { ok: true, data };
  } catch (e) {
    const code = e?.code === "not_configured" ? "email_not_configured" : (e?.message || "email_send_failed");
    return { ok: false, error: code };
  }
}

export default { sendOmniEmailReply };
