import { generateOpaqueToken, sha256Hex } from "./driverToken.js";
import { deriveCustomerTrack, sanitizeSnapshot } from "../../src/utils/logistica/customerTrackView.js";

export const ENSURE_CUSTOMER_TRACK_SQL = `
create table if not exists customer_track_tokens (
  token_id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  trip_id uuid null,
  stop_id uuid null,
  quote_ref text null,
  public_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);
`;

export async function ensureCustomerTrackTable(pool) {
  await pool.query(ENSURE_CUSTOMER_TRACK_SQL);
}

export const CUSTOMER_TRACK_TTL_DEFAULT_DAYS = 21;
export const CUSTOMER_TRACK_TTL_MIN_DAYS = 1;
export const CUSTOMER_TRACK_TTL_MAX_DAYS = 60;
export const PUBLIC_TRACK_TOKEN_MIN_LEN = 16;

/** Same formula the issue route used inline: Number(raw) || 21, then clamp 1..60. */
export function clampCustomerTrackTtlDays(raw) {
  return Math.min(
    CUSTOMER_TRACK_TTL_MAX_DAYS,
    Math.max(CUSTOMER_TRACK_TTL_MIN_DAYS, Number(raw) || CUSTOMER_TRACK_TTL_DEFAULT_DAYS),
  );
}

export function isPublicTrackTokenShape(token) {
  return String(token || "").length >= PUBLIC_TRACK_TOKEN_MIN_LEN;
}

/** After sanitizeSnapshot: need quote_ref or customer_display_name (empty string is not enough). */
export function canIssueCustomerTrack(snapshot) {
  return Boolean(snapshot?.quote_ref || snapshot?.customer_display_name);
}

export function mintTrackToken() {
  const token = generateOpaqueToken(32);
  return { token, tokenHash: sha256Hex(token) };
}

export function trackingPublicUrl(frontendBaseUrl, token) {
  const spa = String(frontendBaseUrl || "https://calculadora-bmc.vercel.app").replace(/\/$/, "");
  return `${spa}/seguimiento/${encodeURIComponent(token)}`;
}

export function buildPublicTrackPayload({ snapshot, tripStatus, events, now }) {
  const view = deriveCustomerTrack({ snapshot, tripStatus, events, now });
  return {
    ok: true,
    ...view,
  };
}

export { sanitizeSnapshot };
