/**
 * Identity resolution — contact lookup / create.
 */
import {
  buildIntegrationUuid,
  normalizeEmail,
  normalizeMlUserId,
  normalizeWaPhone,
} from "../types.js";

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
 * @param {import("pg").PoolClient} client
 * @param {{ contact_hint: object; channel: string; source?: string }} args
 */
export async function resolveContact(client, { contact_hint: hint, channel, source }) {
  if (hint.contact_id) {
    const row = await findContact(
      client,
      `SELECT id, integration_uuid FROM omni_contacts WHERE id = $1 LIMIT 1`,
      [hint.contact_id],
    );
    if (row) {
      return { contact_id: row.id, created: false, integration_uuid: row.integration_uuid };
    }
  }

  const waPhone = normalizeWaPhone(hint.wa_phone || hint.phone);
  const mlUserId = normalizeMlUserId(hint.ml_user_id);
  const email = normalizeEmail(hint.email);
  const integrationUuid = buildIntegrationUuid(hint, channel);

  // Priority order — avoid OR picking the wrong contact when identifiers diverge.
  const byUuid = await findContact(
    client,
    `SELECT id, integration_uuid FROM omni_contacts WHERE integration_uuid = $1 LIMIT 1`,
    [integrationUuid],
  );
  if (byUuid) {
    return { contact_id: byUuid.id, created: false, integration_uuid: byUuid.integration_uuid };
  }

  if (channel === "wa" && waPhone) {
    const row = await findContact(
      client,
      `SELECT id, integration_uuid FROM omni_contacts WHERE wa_phone = $1 LIMIT 1`,
      [waPhone],
    );
    if (row) return { contact_id: row.id, created: false, integration_uuid: row.integration_uuid };
  }

  if (channel === "ml" && mlUserId != null) {
    const row = await findContact(
      client,
      `SELECT id, integration_uuid FROM omni_contacts WHERE ml_user_id = $1 LIMIT 1`,
      [mlUserId],
    );
    if (row) return { contact_id: row.id, created: false, integration_uuid: row.integration_uuid };
  }

  if (channel === "email" && email) {
    const row = await findContact(
      client,
      `SELECT id, integration_uuid FROM omni_contacts WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    if (row) return { contact_id: row.id, created: false, integration_uuid: row.integration_uuid };
  }

  if (hint.chrome_ext_contact_id) {
    const row = await findContact(
      client,
      `SELECT id, integration_uuid FROM omni_contacts WHERE chrome_ext_contact_id = $1 LIMIT 1`,
      [hint.chrome_ext_contact_id],
    );
    if (row) return { contact_id: row.id, created: false, integration_uuid: row.integration_uuid };
  }

  const name = hint.name ? String(hint.name).slice(0, 255) : null;
  const properties = source ? { last_ingest_source: source } : {};

  const ins = await client.query(
    `INSERT INTO omni_contacts
       (integration_uuid, ml_user_id, wa_phone, email, phone, name, properties)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
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
  return {
    contact_id: ins.rows[0].id,
    created: true,
    integration_uuid: ins.rows[0].integration_uuid,
  };
}
