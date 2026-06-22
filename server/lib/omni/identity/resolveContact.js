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
 * @param {{ contact_hint: object; channel: string; source?: string }} args
 */
export async function resolveContact(client, { contact_hint: hint, channel, source }) {
  const waPhone = normalizeWaPhone(hint.wa_phone || hint.phone);
  const mlUserId = normalizeMlUserId(hint.ml_user_id);
  const email = normalizeEmail(hint.email);
  const integrationUuid = buildIntegrationUuid(hint, channel);

  const lookups = [];
  const params = [];
  let i = 1;

  if (waPhone) {
    lookups.push(`wa_phone = $${i++}`);
    params.push(waPhone);
  }
  if (mlUserId != null) {
    lookups.push(`ml_user_id = $${i++}`);
    params.push(mlUserId);
  }
  if (email) {
    lookups.push(`lower(email) = $${i++}`);
    params.push(email);
  }
  if (hint.chrome_ext_contact_id) {
    lookups.push(`chrome_ext_contact_id = $${i++}`);
    params.push(hint.chrome_ext_contact_id);
  }
  lookups.push(`integration_uuid = $${i++}`);
  params.push(integrationUuid);

  if (lookups.length) {
    const { rows } = await client.query(
      `SELECT id, integration_uuid FROM omni_contacts
       WHERE ${lookups.join(" OR ")}
       ORDER BY updated_at DESC
       LIMIT 1`,
      params,
    );
    if (rows[0]) {
      return { contact_id: rows[0].id, created: false, integration_uuid: rows[0].integration_uuid };
    }
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
