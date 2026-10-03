/**
 * Mercado Libre notification auth.
 *
 * Current docs (application security, "Notification security (WebHooks)",
 * checked 2026-10-03) do not send x-signature. They name these source IPs
 * and say the list may change:
 * https://developers.mercadolibre.com.ar/en_us/application-security
 *
 * When x-signature is present, verifyMLSignature stays in charge.
 * A missing header is not an HMAC success. It is accepted only when the
 * peer Cloud Run observed is on this list.
 *
 * Cloud Run appends the connecting address to X-Forwarded-For. Express
 * `trust proxy` 1 can report the leftmost, caller-supplied address.
 * The rightmost address is the peer this process should trust.
 */

export const ML_NOTIFICATION_IPS = Object.freeze([
  "54.88.218.97",
  "18.215.140.160",
  "18.213.114.129",
  "18.206.34.84",
  "35.236.253.169",
  "35.245.91.34",
  "35.245.20.104",
  "35.186.182.146",
]);

const ML_NOTIFICATION_IP_SET = new Set(ML_NOTIFICATION_IPS);

export function normalizePeerIp(value) {
  let ip = String(value ?? "").trim();
  if (!ip) return "";
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    if (end > 1) ip = ip.slice(1, end);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
  return ip;
}

export function cloudRunPeerIp(req) {
  const header = req?.headers?.["x-forwarded-for"];
  const raw = Array.isArray(header) ? header.join(",") : header;
  if (typeof raw === "string" && raw.trim()) {
    const parts = raw.split(",").map((part) => normalizePeerIp(part)).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  const socketIp = req?.socket?.remoteAddress || req?.connection?.remoteAddress || "";
  return normalizePeerIp(socketIp);
}

export function isMlNotificationIp(ip) {
  return ML_NOTIFICATION_IP_SET.has(normalizePeerIp(ip));
}

/**
 * @param {{ mlSigVerified?: { ok?: boolean, skipped?: boolean, reason?: string }, peerIp?: string, webhookVerifyToken?: string, receivedToken?: string }} opts
 * @returns {{ accept: boolean, via: string, reason?: string, peerIp: string }}
 */
export function authorizeMlWebhook({ mlSigVerified, peerIp, webhookVerifyToken, receivedToken } = {}) {
  const verified = mlSigVerified || { ok: false, reason: "missing_signature" };
  const observed = normalizePeerIp(peerIp);
  let decision;

  if (verified.ok) {
    decision = {
      accept: true,
      via: verified.skipped ? "hmac_skipped" : "hmac",
      peerIp: observed,
    };
  } else if (verified.reason === "missing_signature_header" && isMlNotificationIp(observed)) {
    decision = { accept: true, via: "ip_allowlist", peerIp: observed };
  } else {
    return {
      accept: false,
      via: "rejected",
      reason: verified.reason || "invalid_signature",
      peerIp: observed,
    };
  }

  // ML does not send WEBHOOK_VERIFY_TOKEN. Require it only for accepts that
  // did not already match the published notification IP list.
  if (webhookVerifyToken && decision.via !== "ip_allowlist") {
    if (String(receivedToken ?? "") !== String(webhookVerifyToken)) {
      return {
        accept: false,
        via: "rejected",
        reason: "invalid_webhook_token",
        peerIp: observed,
      };
    }
  }

  return decision;
}
