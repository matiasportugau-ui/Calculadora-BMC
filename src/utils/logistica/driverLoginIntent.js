/**
 * BMC Driver login heuristics: fleet chofer (email/phone + password) vs tercero magic-link token.
 */

/** Opaque tokens from generateOpaqueToken(32) are base64url ≈43 chars; passwords are shorter. */
export function looksLikeOpaqueDriverToken(value) {
  const t = String(value || "").trim();
  return t.length >= 32 && /^[A-Za-z0-9_-]+$/.test(t);
}

export function identityLooksLikeEmailOrPhone(identity) {
  const id = String(identity || "").trim();
  if (id.includes("@")) return true;
  const digits = id.replace(/\D/g, "");
  return digits.length >= 8;
}

/**
 * Decide how /conductor should authenticate.
 * @returns {{ mode: 'chofer_password' | 'magic_token', tokenCandidate: string, identity: string }}
 */
export function resolveDriverLoginIntent(identity, password) {
  const id = String(identity || "").trim();
  const pw = String(password || "").trim();
  if (identityLooksLikeEmailOrPhone(id) && pw && !looksLikeOpaqueDriverToken(pw)) {
    return { mode: "chofer_password", tokenCandidate: pw, identity: id };
  }
  return { mode: "magic_token", tokenCandidate: pw || id, identity: id };
}
