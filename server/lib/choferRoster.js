/**
 * HITL chofer roster (T5–T6). Operator creates users; magic-link trip tokens stay for terceros.
 */
import crypto from "node:crypto";
import { ensureTransportistaSchema } from "./transportistaSchema.js";
import { generateOpaqueToken, sha256Hex } from "./driverToken.js";

/** Reject oversized passwords before scrypt — login is unauthenticated. */
export const CHOFER_PASSWORD_MIN = 6;
export const CHOFER_PASSWORD_MAX = 128;

export function digitsPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d : "";
}

export function hashChoferPassword(plain) {
  const pw = String(plain || "");
  if (pw.length > CHOFER_PASSWORD_MAX) {
    throw new Error("password_too_long");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyChoferPassword(plain, stored) {
  const pw = String(plain || "");
  // Cap before scrypt so unauthenticated /torre/chofer/login cannot stall the event loop.
  if (pw.length > CHOFER_PASSWORD_MAX) return false;
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(pw, salt, 32).toString("hex");
  if (hash.length !== check.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

export async function registerChofer(pool, { name, email, phone, password } = {}) {
  await ensureTransportistaSchema(pool);
  const pw = String(password || "");
  if (pw.length < CHOFER_PASSWORD_MIN) return { ok: false, error: "password_too_short" };
  if (pw.length > CHOFER_PASSWORD_MAX) return { ok: false, error: "password_too_long" };
  const phone_e164 = digitsPhone(phone);
  const mail = String(email || "").trim().toLowerCase() || null;
  if (!mail && !phone_e164) return { ok: false, error: "email_or_phone_required" };
  const password_hash = hashChoferPassword(pw);
  const { rows } = await pool.query(
    `insert into chofer_roster (name, email, phone_e164, password_hash, status)
     values ($1, $2, $3, $4, 'active')
     returning chofer_id, name, email, phone_e164, status`,
    [String(name || "").trim() || null, mail, phone_e164 || null, password_hash],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "insert_failed" };
  return {
    ok: true,
    chofer: {
      chofer_id: row.chofer_id,
      name: row.name,
      email: row.email,
      phone_e164: row.phone_e164,
      status: row.status || "active",
    },
  };
}

export async function loginChofer(pool, { email, phone, password } = {}) {
  await ensureTransportistaSchema(pool);
  const mail = String(email || "").trim().toLowerCase();
  const phone_e164 = digitsPhone(phone);
  let rows = [];
  if (mail) {
    const q = await pool.query(`select * from chofer_roster where lower(email) = $1 and status = 'active'`, [mail]);
    rows = q.rows;
  } else if (phone_e164) {
    const q = await pool.query(`select * from chofer_roster where phone_e164 = $1 and status = 'active'`, [phone_e164]);
    rows = q.rows;
  } else {
    return { ok: false, error: "email_or_phone_required" };
  }
  const chofer = rows[0];
  if (!chofer || !verifyChoferPassword(password, chofer.password_hash)) {
    return { ok: false, error: "invalid_credentials" };
  }
  const token = generateOpaqueToken(32);
  const expires = new Date(Date.now() + 24 * 3600 * 1000);
  await pool.query(
    `insert into chofer_sessions (chofer_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [chofer.chofer_id, sha256Hex(token), expires.toISOString()],
  );
  return {
    ok: true,
    token,
    expires_at: expires.toISOString(),
    chofer: {
      chofer_id: chofer.chofer_id,
      name: chofer.name,
      email: chofer.email,
      phone_e164: chofer.phone_e164,
    },
  };
}

export async function assignTripToChofer(pool, { tripId, choferId } = {}) {
  await ensureTransportistaSchema(pool);
  if (!tripId || !choferId) return { ok: false, error: "trip_and_chofer_required" };
  const { rows: ch } = await pool.query(`select * from chofer_roster where chofer_id = $1`, [choferId]);
  if (!ch[0]) return { ok: false, error: "chofer_not_found" };
  await pool.query(
    `update trips
        set assigned_driver_id = $2::uuid,
            assigned_phone_e164 = coalesce(assigned_phone_e164, $3),
            status = case when status = 'draft' then 'assigned' else status end,
            updated_at = now()
      where trip_id = $1::uuid`,
    [tripId, choferId, ch[0].phone_e164 || null],
  );
  return { ok: true, trip_id: tripId, chofer_id: choferId };
}

export async function listChoferInbox(pool, choferId) {
  await ensureTransportistaSchema(pool);
  const { rows } = await pool.query(
    `select trip_id, status, plan_snapshot, assigned_driver_id, assigned_phone_e164, closed_at, updated_at
       from trips
      where assigned_driver_id = $1::uuid
      order by updated_at desc`,
    [choferId],
  );
  return { ok: true, trips: rows };
}
