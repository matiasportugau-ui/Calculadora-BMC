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

export function mintTrackToken() {
  const token = generateOpaqueToken(32);
  return { token, tokenHash: sha256Hex(token) };
}

export function trackingPublicUrl(frontendBaseUrl, token) {
  const spa = String(frontendBaseUrl || "https://calculadora-bmc.vercel.app").replace(/\/$/, "");
  return `${spa}/seguimiento/${encodeURIComponent(token)}`;
}

export function buildPublicTrackPayload({ snapshot, tripStatus, events, now, stopId }) {
  const view = deriveCustomerTrack({ snapshot, tripStatus, events, now, stopId });
  return {
    ok: true,
    ...view,
  };
}

export { sanitizeSnapshot };
