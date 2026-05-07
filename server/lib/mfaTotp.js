/**
 * mfaTotp — TOTP (RFC 6238) MFA helpers for identity admins.
 *
 * Persistence contract (see supabase/migrations/20260601000004_identity_mfa.sql):
 *   identity.mfa_secrets.totp_secret_encrypted bytea
 *     layout = IV (12 bytes) || ciphertext || tag (16 bytes)
 *     cipher = AES-256-GCM
 *     key    = MFA_KEK_HEX env (64 hex chars / 32 bytes)
 *
 * The KEK is intentionally separate from IDENTITY_JWT_SECRET so JWT secret
 * rotation does not silently re-key every enrolled secret.
 *
 * Verification window is ±1 step (default 30s) which tolerates clock drift
 * but stays inside the OWASP-recommended bound.
 */

import crypto from "node:crypto";
import {
  generateSecret as _generateSecret,
  generateURI as _generateURI,
  verifySync as _verifySync,
} from "otplib";

// 30s period, 6-digit code, ±1-step window (= ±30s drift tolerance).
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

const KEK_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKek() {
  const hex = process.env.MFA_KEK_HEX || "";
  if (!hex || hex.length !== KEK_BYTES * 2 || !/^[0-9a-fA-F]+$/.test(hex)) {
    const msg = "[mfaTotp] MFA_KEK_HEX must be 64 hex chars (32 bytes)";
    const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
    if (appEnv === "production") throw Object.assign(new Error(msg), { status: 500 });
    throw Object.assign(new Error(msg), { status: 500 });
  }
  return Buffer.from(hex, "hex");
}

/** Generate a fresh base32 secret. */
export function generateSecret() {
  return _generateSecret(); // base32, 32 chars (160 bits)
}

/**
 * Build a `otpauth://` URI for QR provisioning. `accountLabel` is shown by
 * the authenticator app; use the user's email for clarity.
 */
export function buildProvisioningUri({ secret, accountLabel, issuer = "Calculadora BMC" } = {}) {
  if (!secret) throw new Error("buildProvisioningUri: secret required");
  if (!accountLabel) throw new Error("buildProvisioningUri: accountLabel required");
  return _generateURI({
    strategy: "totp",
    issuer,
    label: accountLabel,
    secret,
    period: TOTP_PERIOD,
    digits: TOTP_DIGITS,
  });
}

/**
 * Constant-time-equivalent verification (otplib uses crypto.timingSafeEqual
 * internally). Returns boolean.
 */
export function verifyCode({ secret, code } = {}) {
  if (!secret || !code) return false;
  const cleaned = String(code).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const r = _verifySync({
      secret,
      token: cleaned,
      window: TOTP_WINDOW,
      period: TOTP_PERIOD,
      digits: TOTP_DIGITS,
    });
    return !!r?.valid;
  } catch {
    return false;
  }
}

/**
 * Encrypt a base32 TOTP secret with AES-256-GCM.
 * Output: IV(12) || ciphertext || tag(16) as Buffer.
 */
export function encryptSecret(plainSecret) {
  if (typeof plainSecret !== "string" || !plainSecret.length) {
    throw new Error("encryptSecret: plainSecret must be a non-empty string");
  }
  const key = getKek();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]);
}

/** Reverse of encryptSecret. Throws on tag mismatch. */
export function decryptSecret(encrypted) {
  if (!Buffer.isBuffer(encrypted) || encrypted.length <= IV_BYTES + TAG_BYTES) {
    throw new Error("decryptSecret: malformed payload");
  }
  const key = getKek();
  const iv = encrypted.subarray(0, IV_BYTES);
  const tag = encrypted.subarray(encrypted.length - TAG_BYTES);
  const ct = encrypted.subarray(IV_BYTES, encrypted.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export const __test__ = { TOTP_PERIOD, TOTP_DIGITS, TOTP_WINDOW };
