// ═══════════════════════════════════════════════════════════════════════════
// server/lib/emailReply.js — Outbound email reply for the CRM cockpit.
// ───────────────────────────────────────────────────────────────────────────
// Sends a reply from the casilla that received the customer email, reusing the
// per-casilla SMTP config in the sibling repo's config/accounts.json (the same
// `passwordEnv` already used for IMAP — cPanel hosts share the login). Synchronous
// send to match the existing ML/WhatsApp branches in handleCrmCockpitSendApproved.
// Pure helpers (extractEmailAddress, resolveCasillaSmtp) are exported for offline
// unit tests; sendEmailReply accepts an injectable transport for the same reason.
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { resolveEmailInboxRepoRoot } from "./emailInboxRepoResolve.js";
import { isGmailSendConfigured, sendGmailReply } from "./gmailSend.js";

let _accountsCache = null;

/** Pull the first RFC-ish email address out of a string ("Nombre <a@b.com>", "a@b.com", …). */
export function extractEmailAddress(str) {
  if (!str || typeof str !== "string") return "";
  const m = str.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : "";
}

/** Read config/accounts.json from the sibling repo (cached). Returns []. */
export function loadAccounts(opts = {}) {
  if (Array.isArray(opts.accounts)) return opts.accounts; // test injection
  if (_accountsCache && !opts.force) return _accountsCache;
  try {
    const root = resolveEmailInboxRepoRoot({ bmcEmailInboxRepo: opts.repoRoot });
    const raw = fs.readFileSync(path.join(root, "config", "accounts.json"), "utf8");
    const json = JSON.parse(raw);
    _accountsCache = Array.isArray(json) ? json : Array.isArray(json?.accounts) ? json.accounts : [];
  } catch {
    _accountsCache = [];
  }
  return _accountsCache;
}

/**
 * Resolve the SMTP transport config for a casilla id (e.g. "bmc-ventas").
 * @returns {{ host, port, secure, user, pass, from } | null} — null if not configured.
 */
export function resolveCasillaSmtp(accountId, opts = {}) {
  if (!accountId) return null;
  const accounts = loadAccounts(opts);
  const acc = accounts.find((a) => a?.id === accountId);
  const smtp = acc?.smtp;
  if (!acc || !smtp?.host) return null;
  const pass = smtp.passwordEnv ? (opts.env || process.env)[smtp.passwordEnv] : "";
  if (!pass) return null; // password not present in this environment
  return {
    host: smtp.host,
    port: Number(smtp.port || 465),
    secure: smtp.secure !== false, // default SSL (465)
    user: smtp.user || acc.user,
    pass,
    from: smtp.user || acc.user,
  };
}

/**
 * Send a reply. Resolves per-casilla SMTP; throws a clear Error if the casilla
 * is not send-configured (the caller maps that to a 503).
 * @param {{ account: string, to: string, subject: string, text: string,
 *           inReplyTo?: string, sendMail?: Function, accounts?: any[], env?: object }} args
 */
export async function sendEmailReply(args) {
  const { account, to, subject, text, inReplyTo } = args || {};
  const recipient = extractEmailAddress(to);
  if (!recipient) throw new Error("email_reply_no_recipient");

  // Prefer the Gmail API when configured: the per-casilla Netuy SMTP boxes are
  // dead (bmcuruguay.com.uy moved to Cloudflare→Gmail). SMTP stays as a fallback
  // for any casilla still on a live host. Set `preferSmtp:true` to force SMTP.
  const env = args.env || process.env;
  if (args.preferSmtp !== true && typeof args.sendMail !== "function" && isGmailSendConfigured(env)) {
    return sendGmailReply({ to: recipient, subject, text, inReplyTo, from: args.from, env, sendRaw: args.sendRaw });
  }

  const smtp = resolveCasillaSmtp(account, args);
  if (!smtp) {
    const e = new Error(`email_reply_not_configured: casilla '${account || "?"}' has no SMTP/password`);
    e.code = "not_configured";
    throw e;
  }

  const message = {
    from: smtp.from,
    to: recipient,
    subject: subject || "Re:",
    text: text || "",
    ...(inReplyTo ? { inReplyTo, references: inReplyTo } : {}),
  };

  if (typeof args.sendMail === "function") {
    // test / injected transport
    return args.sendMail({ smtp, message });
  }
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  const info = await transporter.sendMail(message);
  return { messageId: info?.messageId || null, accepted: info?.accepted || [recipient] };
}

/** Tests only. */
export function _resetEmailReplyCache() {
  _accountsCache = null;
}
