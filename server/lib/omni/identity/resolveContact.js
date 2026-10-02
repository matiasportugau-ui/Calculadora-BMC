/**
 * Identity resolution — contact lookup / create.
 */
import {
  buildIntegrationUuid,
  normalizeEmail,
  normalizeMlUserId,
  normalizeWaPhone,
} from "../types.js";

/** Cap merge-chain walks (cycle / pathological depth). */
const MERGED_INTO_MAX_DEPTH = 8;

/**
 * @param {import("pg").PoolClient} client
 * @param {string} sql
 * @param {unknown[]} params
 */
async function findContact(client, sql, params) {
  const { rows } = await client.query(sql, params);
  return rows[0] || null;
}

/**
 * Soft-merged losers keep their UNIQUE keys (or at least integration_uuid).
 * Ingest must follow properties.merged_into to the survivor, or new channel
 * traffic lands on a Contactos-Unificados-hidden row and splits the thread.
 * @param {import("pg").PoolClient} client
 * @param {{ id: string, integration_uuid?: string, merged_into?: string|null } | null} row
 * @param {number} [depth]
 */
export async function followMergedInto(client, row, depth = 0) {
  if (!row?.id) return row;
  const mergedInto = row.merged_into ? String(row.merged_into) : null;
  if (!mergedInto) return row;
  if (mergedInto === row.id) return row;
  if (depth >= MERGED_INTO_MAX_DEPTH) return row;

  const next = await findContact(
    client,
    `SELECT id, integration_uuid, properties->>'merged_into' AS merged_into
       FROM omni_contacts WHERE id = $1 LIMIT 1`,
    [mergedInto],
  );
  if (!next) return row;
  return followMergedInto(client, next, depth + 1);
}

/**
 * Identity lookup in priority order (integration_uuid → channel key → chrome ext).
 * Re-used both BEFORE the insert and AGAIN after an `ON CONFLICT DO NOTHING`, so a
 * contact created by a concurrent transaction is resolved instead of dropped
 * (fixes the SELECT-then-INSERT race that silently lost inbound messages).
 * @param {import("pg").PoolClient} client
 */
async function findExistingContact(client, { integrationUuid, channel, waPhone, mlUserId, email, chromeExt }) {
  const selectCols = `id, integration_uuid, properties->>'merged_into' AS merged_into`;

  const byUuid = await findContact(
    client,
    `SELECT ${selectCols} FROM omni_contacts WHERE integration_uuid = $1 LIMIT 1`,
    [integrationUuid],
  );
  if (byUuid) return followMergedInto(client, byUuid);

  if (channel === "wa" && waPhone) {
    const r = await findContact(client, `SELECT ${selectCols} FROM omni_contacts WHERE wa_phone = $1 LIMIT 1`, [waPhone]);
    if (r) return followMergedInto(client, r);
  }
  if (channel === "ml" && mlUserId != null) {
    const r = await findContact(client, `SELECT ${selectCols} FROM omni_contacts WHERE ml_user_id = $1 LIMIT 1`, [mlUserId]);
    if (r) return followMergedInto(client, r);
  }
  if (channel === "email" && email) {
    const r = await findContact(client, `SELECT ${selectCols} FROM omni_contacts WHERE lower(email) = $1 LIMIT 1`, [email]);
    if (r) return followMergedInto(client, r);
  }
  if (chromeExt) {
    const r = await findContact(client, `SELECT ${selectCols} FROM omni_contacts WHERE chrome_ext_contact_id = $1 LIMIT 1`, [chromeExt]);
    if (r) return followMergedInto(client, r);
  }
  return null;
}

/**
 * @param {import("pg").PoolClient} client
 * @param {{ contact_hint: object; channel: string; source?: string }} args
 */
export async function resolveContact(client, { contact_hint: hint, channel, source }) {
  if (hint.contact_id) {
    const row = await findContact(
      client,
      `SELECT id, integration_uuid, properties->>'merged_into' AS merged_into
         FROM omni_contacts WHERE id = $1 LIMIT 1`,
      [hint.contact_id],
    );
    if (row) {
      const resolved = await followMergedInto(client, row);
      return { contact_id: resolved.id, created: false, integration_uuid: resolved.integration_uuid };
    }
  }

  const waPhone = normalizeWaPhone(hint.wa_phone || hint.phone);
  const mlUserId = normalizeMlUserId(hint.ml_user_id);
  const email = normalizeEmail(hint.email);
  const integrationUuid = buildIntegrationUuid(hint, channel);

  // Priority order — avoid OR picking the wrong contact when identifiers diverge.
  const lookup = {
    integrationUuid,
    channel,
    waPhone,
    mlUserId,
    email,
    chromeExt: hint.chrome_ext_contact_id || null,
  };

  const existing = await findExistingContact(client, lookup);
  if (existing) {
    return { contact_id: existing.id, created: false, integration_uuid: existing.integration_uuid };
  }

  const name = hint.name ? String(hint.name).slice(0, 255) : null;
  const properties = {
    ...(source ? { last_ingest_source: source } : {}),
    ...(hint.igsid ? { igsid: String(hint.igsid).slice(0, 255) } : {}),
    ...(hint.psid ? { psid: String(hint.psid).slice(0, 255) } : {}),
  };

  // ON CONFLICT DO NOTHING on any UNIQUE key (integration_uuid / ml_user_id /
  // wa_phone / chrome_ext_contact_id — email is NOT unique; it dedups via the
  // email-derived integration_uuid) so a concurrent insert of the same contact
  // never aborts the transaction and drops the inbound message — we re-resolve below.
  const ins = await client.query(
    `INSERT INTO omni_contacts
       (integration_uuid, ml_user_id, wa_phone, email, phone, name, properties)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING id, integration_uuid`,
    [
      integrationUuid,
      mlUserId,
      waPhone,
      email,
      waPhone,
      name,
      JSON.stringify(properties),
    ],
  );
  if (ins.rows[0]) {
    return { contact_id: ins.rows[0].id, created: true, integration_uuid: ins.rows[0].integration_uuid };
  }

  // A concurrent transaction won the race; resolve the contact it just created.
  const after = await findExistingContact(client, lookup);
  if (after) {
    return { contact_id: after.id, created: false, integration_uuid: after.integration_uuid };
  }
  throw new Error("resolveContact: insert conflicted but contact not found on re-resolve");
}
