import crypto from "node:crypto";

/**
 * Verifica x-hub-signature-256 (Meta WhatsApp / Graph webhooks).
 * @param {{ appSecret: string, rawBodyBuffer: Buffer, signatureHeader: string | undefined, requireSignature?: boolean }} opts
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string }}
 */
export function verifyWhatsAppSignature({
  appSecret,
  rawBodyBuffer,
  signatureHeader,
  requireSignature = false,
}) {
  if (!appSecret) {
    return requireSignature
      ? { ok: false, reason: "missing_app_secret" }
      : { ok: true, skipped: true };
  }
  if (!signatureHeader || !rawBodyBuffer) return { ok: false, reason: "missing_header_or_body" };
  const sig = String(signatureHeader).trim();
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBodyBuffer).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return { ok: false, reason: "length" };
  try {
    return { ok: crypto.timingSafeEqual(a, b) };
  } catch {
    return { ok: false, reason: "compare" };
  }
}
