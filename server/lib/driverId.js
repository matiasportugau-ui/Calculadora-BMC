import crypto from "node:crypto";

const NS = "bmc-driver-loop-v1";

/**
 * Deterministic UUID (version-5-like) from E.164 digits. No roster table in v1.
 * @param {string} phoneE164
 */
export function driverIdFromPhone(phoneE164) {
  const digits = String(phoneE164 || "").replace(/\D/g, "") || "anonymous";
  const h = crypto.createHash("sha256").update(`${NS}:${digits}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ensureStopUuid(stop, index) {
  const raw = String(stop?.id || "").trim();
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRe.test(raw)) return raw;
  return driverIdFromPhone(`stop:${index}:${raw || "x"}`);
}

export function isPickupStop(stop) {
  const k = `${stop?.kind || ""} ${stop?.tipo || ""} ${stop?.role || ""}`.toLowerCase();
  return /\b(pickup|levante|planta|fabrica|fábrica|deposito|depósito)\b/.test(k);
}
