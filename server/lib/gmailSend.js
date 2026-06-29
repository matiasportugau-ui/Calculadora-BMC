// ═══════════════════════════════════════════════════════════════════════════
// server/lib/gmailSend.js — Outbound email via the Gmail API (user-OAuth).
// ───────────────────────────────────────────────────────────────────────────
// bmcuruguay.com.uy migrated to Cloudflare Email Routing (forwarding-only): the
// per-casilla Netuy SMTP boxes are dead. Inbound mail now funnels into one Gmail
// inbox; replies go back out through that same account via the Gmail API, using
// the user-OAuth refresh token minted by the sibling pipeline's `gmail-auth`
// (scope `gmail.send`, reusing GOOGLE_DRIVE_CLIENT_ID/SECRET).
//
// buildRawMessage() is a pure RFC822 builder, exported for offline unit tests;
// sendGmailReply() accepts an injectable `sendRaw` transport for the same reason.
//
// Note on identity: Gmail sends as the authenticated account unless `from` is a
// verified "Send mail as" alias on it. We only set a From header when an explicit
// alias is supplied (GMAIL_SEND_FROM / args.from); otherwise Gmail stamps the
// account address, which is correct for a single shared inbox.
// ═══════════════════════════════════════════════════════════════════════════

/** True when the Gmail-API send path is fully configured in this environment. */
export function isGmailSendConfigured(env = process.env) {
  return Boolean(
    env.GMAIL_INGEST_REFRESH_TOKEN && env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
}

/** RFC 2047 encode a header value only if it carries non-ASCII (keeps ASCII subjects clean). */
function encodeHeader(value) {
  const s = String(value || "");
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

/** base64url (no padding) per Gmail API `raw` requirement. */
function base64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build a base64url-encoded RFC822 message for gmail.users.messages.send.
 * Threads via In-Reply-To / References when `inReplyTo` (a Message-ID) is given.
 * @param {{ to:string, subject?:string, text?:string, inReplyTo?:string, from?:string }} args
 * @returns {string} base64url raw message
 */
export function buildRawMessage({ to, subject, text, inReplyTo, from } = {}) {
  if (!to) throw new Error("gmail_send_no_recipient");
  const headers = [];
  if (from) headers.push(`From: ${from}`);
  headers.push(`To: ${to}`);
  headers.push(`Subject: ${encodeHeader(subject || "Re:")}`);
  if (inReplyTo) {
    // Message-IDs travel in angle brackets; tolerate callers that omit them.
    const id = /^<.*>$/.test(inReplyTo) ? inReplyTo : `<${inReplyTo}>`;
    headers.push(`In-Reply-To: ${id}`);
    headers.push(`References: ${id}`);
  }
  headers.push("MIME-Version: 1.0");
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push("Content-Transfer-Encoding: base64");
  const body = Buffer.from(String(text || ""), "utf8").toString("base64");
  return base64url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}

/**
 * Send a reply via the Gmail API. Throws an Error with `.code="not_configured"`
 * when the token/client are absent (caller maps that to a 503, same contract as
 * the SMTP path).
 * @param {{ to:string, subject?:string, text?:string, inReplyTo?:string,
 *           from?:string, env?:object, sendRaw?:Function }} args
 * @returns {Promise<{ messageId:string|null, threadId:string|null, accepted:string[], transport:"gmail" }>}
 */
export async function sendGmailReply(args = {}) {
  const { to, subject, text, inReplyTo, sendRaw } = args;
  const env = args.env || process.env;
  if (!isGmailSendConfigured(env)) {
    const e = new Error("gmail_send_not_configured: missing GMAIL_INGEST_REFRESH_TOKEN / client creds");
    e.code = "not_configured";
    throw e;
  }
  const from = args.from || env.GMAIL_SEND_FROM || "";
  const raw = buildRawMessage({ to, subject, text, inReplyTo, from: from || undefined });

  if (typeof sendRaw === "function") {
    // test / injected transport — receives the prepared raw + parsed intent
    const r = await sendRaw({ raw, to, subject, inReplyTo, from });
    return { messageId: r?.id || null, threadId: r?.threadId || null, accepted: [to], transport: "gmail" };
  }

  const { google } = await import("googleapis");
  const oauth2 = new google.auth.OAuth2(env.GOOGLE_DRIVE_CLIENT_ID, env.GOOGLE_DRIVE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: env.GMAIL_INGEST_REFRESH_TOKEN });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const resp = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return {
    messageId: resp?.data?.id || null,
    threadId: resp?.data?.threadId || null,
    accepted: [to],
    transport: "gmail",
  };
}

export default { isGmailSendConfigured, buildRawMessage, sendGmailReply };
