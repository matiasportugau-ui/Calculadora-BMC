/**
 * Bind Admin 2.0 row writes to the identify-minted session.
 *
 * Public /chat and /log must not trust client-supplied adminRow (IDOR → overwrite
 * col J / CRM AF). Identify mints an HMAC token; later writes resolve the row
 * only from a verified token.
 *
 * Signing key: IDENTITY_JWT_SECRET (already on Cloud Run). Fail closed when unset.
 */
import crypto from "node:crypto";
import { config } from "../../config.js";
import { normalizeStorefrontPhone } from "./storefrontVoicePack.js";

export const STOREFRONT_ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

export function storefrontBindingSecret(cfg = config) {
  const s = String(cfg?.identityJwtSecret || "").trim();
  return s.length >= 16 ? s : "";
}

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function signPayload(payloadB64, secret) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function safeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/**
 * @returns {string|null} opaque token, or null if secret/row invalid
 */
export function mintStorefrontAdminToken(
  { adminRow, telefono } = {},
  cfg = config,
  now = Date.now(),
) {
  const secret = storefrontBindingSecret(cfg);
  if (!secret) return null;
  const ar = Number(adminRow);
  if (!Number.isFinite(ar) || ar < 2) return null;
  const ph = normalizeStorefrontPhone(telefono);
  if (ph.length < 8) return null;
  const payloadB64 = b64urlJson({
    ar,
    ph,
    exp: Number(now) + STOREFRONT_ADMIN_TOKEN_TTL_MS,
  });
  return `${payloadB64}.${signPayload(payloadB64, secret)}`;
}

/**
 * Resolve Admin row from token only. Optional telefono must match when provided.
 * Never trusts a raw adminRow from the client.
 *
 * @returns {{ ok: true, adminRow: number } | { ok: false, error: string }}
 */
export function resolveBoundAdminRow(
  { adminToken, telefono } = {},
  cfg = config,
  now = Date.now(),
) {
  const secret = storefrontBindingSecret(cfg);
  if (!secret) {
    return { ok: false, error: "binding secret unavailable" };
  }
  const raw = String(adminToken || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return { ok: false, error: "adminToken requerido" };
  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!sig || !safeEqualStr(sig, signPayload(payloadB64, secret))) {
    return { ok: false, error: "adminToken inválido" };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "adminToken inválido" };
  }
  const ar = Number(payload?.ar);
  if (!Number.isFinite(ar) || ar < 2) {
    return { ok: false, error: "adminToken inválido" };
  }
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp < Number(now)) {
    return { ok: false, error: "adminToken expirado" };
  }
  const tokenPhone = String(payload?.ph || "");
  if (tokenPhone.length < 8) {
    return { ok: false, error: "adminToken inválido" };
  }
  if (telefono != null && String(telefono).trim() !== "") {
    const ph = normalizeStorefrontPhone(telefono);
    if (ph.length >= 8 && !safeEqualStr(ph, tokenPhone)) {
      return { ok: false, error: "adminToken no coincide con el teléfono" };
    }
  }
  return { ok: true, adminRow: ar };
}
