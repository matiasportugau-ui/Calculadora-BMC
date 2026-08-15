const MAX_BYTES = 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  const head = buf.subarray(0, Math.min(buf.length, 256)).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  return null;
}

export function validateLogoBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf)) {
    return { ok: false, error: "missing_logo", status: 400 };
  }
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: "logo_too_large", status: 400 };
  }
  const mime = sniffImageMime(buf);
  if (mime === "image/svg+xml" || !mime || !ALLOWED.has(mime)) {
    return { ok: false, error: "invalid_logo_type", status: 400 };
  }
  return { ok: true, mime, bytes: buf.length };
}

export function toDataUrl(buf, mime) {
  return `data:${mime};base64,${buf.toString("base64")}`;
}
