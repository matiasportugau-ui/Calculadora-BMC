/**
 * PEA audit trail — pea.audit_events
 */

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ actorId?: string, action: string, resourceType: string, resourceId?: string, metadata?: object }} evt
 */
export async function recordPeaAudit(db, evt) {
  const { rows } = await db.query(
    `INSERT INTO pea.audit_events (actor_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, created_at`,
    [
      evt.actorId || null,
      evt.action,
      evt.resourceType,
      evt.resourceId || null,
      JSON.stringify(evt.metadata || {}),
    ],
  );
  return rows[0];
}
