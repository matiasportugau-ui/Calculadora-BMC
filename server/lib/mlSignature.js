import crypto from "node:crypto";

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies the x-signature header sent by MercadoLibre on webhook notifications.
 *
 * ML signs a structured string — NOT the raw body — using the OAuth client secret:
 *   template = "id:{data.id};request-id:{x-request-id};ts:{ts}"
 *   expected = HMAC-SHA256(clientSecret, template).hex
 *
 * Header format: "ts=UNIX_MS,v1=HEX_HASH"
 *
 * @param {{ clientSecret: string, signatureHeader: string | undefined, dataId: string | number | undefined, requestId: string | undefined, nowMs?: number }} opts
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string }}
 */
export function verifyMLSignature({ clientSecret, signatureHeader, dataId, requestId, nowMs }) {
  if (!clientSecret) return { ok: true, skipped: true };

  if (!signatureHeader) return { ok: false, reason: "missing_signature_header" };

  // Parse "ts=123456789,v1=abcdef..."
  const tsMatch = signatureHeader.match(/ts=(\d+)/);
  const v1Match = signatureHeader.match(/v1=([0-9a-f]+)/i);

  if (!tsMatch || !v1Match) return { ok: false, reason: "malformed_signature_header" };

  const ts = tsMatch[1];
  const receivedHash = v1Match[1].toLowerCase();

  // Replay protection: reject if timestamp is more than 5 minutes old
  const tsMs = Number(ts);
  const now = nowMs !== undefined ? nowMs : Date.now();
  if (Math.abs(now - tsMs) > REPLAY_WINDOW_MS) {
    return { ok: false, reason: "replay_too_old" };
  }

  // Build the template ML uses as the signing payload
  const parts = [];
  if (dataId !== undefined && dataId !== null && dataId !== "") {
    parts.push(`id:${dataId}`);
  }
  if (requestId) {
    parts.push(`request-id:${requestId}`);
  }
  parts.push(`ts:${ts}`);
  const template = parts.join(";");

  const expected = crypto.createHmac("sha256", clientSecret).update(template).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(receivedHash, "utf8");

  if (a.length !== b.length) return { ok: false, reason: "length" };

  try {
    return { ok: crypto.timingSafeEqual(a, b) };
  } catch {
    return { ok: false, reason: "compare" };
  }
}
