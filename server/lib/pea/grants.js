/**
 * PEA durable grants (L0–L5). M2b: create/revoke capped at L3.
 */
import { recordPeaAudit } from "./auditEvents.js";
import { insertOutboxEvent } from "./outbox.js";

const M2B_MAX_GRANT_LEVEL = 3;
const DEFAULT_GRANT_TTL_HOURS = 72;

/**
 * @param {import('../../config.js').config} config
 * @param {number} requestedLevel
 */
export function capGrantLevel(config, requestedLevel) {
  const max = config.peaMaxGrantLevel ?? M2B_MAX_GRANT_LEVEL;
  return Math.max(0, Math.min(max, Number(requestedLevel) || 0));
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ maxLevel: number, scope: string, grantedBy: string, gapIds?: string[], packetId?: string, ttlHours?: number, metadata?: object }} input
 */
export async function createPeaGrant(db, config, input) {
  const maxLevel = capGrantLevel(config, input.maxLevel);
  if (maxLevel < 3) {
    const err = new Error("grant_level_too_low");
    err.code = "grant_level_too_low";
    throw err;
  }
  const ttlHours = input.ttlHours ?? DEFAULT_GRANT_TTL_HOURS;
  const scope = String(input.scope || "").slice(0, 256);
  if (!scope) throw new Error("scope_required");

  const { rows } = await db.query(
    `INSERT INTO pea.grants
       (max_level, scope, granted_by, expires_at, gap_ids, packet_id, metadata)
     VALUES ($1, $2, $3, now() + ($4 || ' hours')::interval, $5::jsonb, $6, $7::jsonb)
     RETURNING *`,
    [
      maxLevel,
      scope,
      input.grantedBy,
      String(ttlHours),
      JSON.stringify(input.gapIds || []),
      input.packetId || null,
      JSON.stringify(input.metadata || {}),
    ],
  );
  const grant = rows[0];

  await recordPeaAudit(db, {
    actorId: input.grantedBy,
    action: "grant.create",
    resourceType: "grant",
    resourceId: grant.id,
    metadata: { max_level: maxLevel, scope, packet_id: input.packetId || null },
  });

  await insertOutboxEvent(db, {
    aggregateType: "grant",
    aggregateId: grant.id,
    eventType: "grant.created",
    payload: { grant_id: grant.id, max_level: maxLevel },
  });

  return grant;
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ grantId: string, revokedBy: string, reason?: string }} input
 */
export async function revokePeaGrant(db, input) {
  const { rows } = await db.query(
    `UPDATE pea.grants SET revoked_at = now(), metadata = metadata || $2::jsonb
     WHERE id = $1 AND revoked_at IS NULL
     RETURNING *`,
    [
      input.grantId,
      JSON.stringify({ revoke_reason: input.reason || null, revoked_by: input.revokedBy }),
    ],
  );
  if (!rows[0]) return null;

  await recordPeaAudit(db, {
    actorId: input.revokedBy,
    action: "grant.revoke",
    resourceType: "grant",
    resourceId: input.grantId,
    metadata: { reason: input.reason || null },
  });

  return rows[0];
}

/**
 * Revoke every active grant scoped to a packet (Bug DB).
 * Used when accept/reject terminalizes a packet so orphan L3 grants cannot
 * still authorize implement.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ packetId: string, revokedBy: string, reason?: string }} input
 */
export async function revokePeaGrantsForPacket(db, input) {
  const scope = `packet:${input.packetId}`;
  const { rows } = await db.query(
    `UPDATE pea.grants SET revoked_at = now(), metadata = metadata || $3::jsonb
     WHERE revoked_at IS NULL
       AND (packet_id = $1 OR scope = $2)
     RETURNING id`,
    [
      input.packetId,
      scope,
      JSON.stringify({
        revoke_reason: input.reason || "packet_terminalized",
        revoked_by: input.revokedBy,
      }),
    ],
  );
  for (const row of rows) {
    await recordPeaAudit(db, {
      actorId: input.revokedBy,
      action: "grant.revoke",
      resourceType: "grant",
      resourceId: row.id,
      metadata: {
        reason: input.reason || "packet_terminalized",
        packet_id: input.packetId,
      },
    });
  }
  return rows;
}
