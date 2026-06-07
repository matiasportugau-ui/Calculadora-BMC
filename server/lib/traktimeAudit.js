/**
 * Append-only audit log helper for TraKtiMe.
 * Call from any route handler that mutates state:
 *   await tkAudit(pool, { action, row_table, row_id, before, after, user_email, meta })
 *
 * Never throws — logging failures should not block business operations.
 */
export async function tkAudit(pool, entry, logger) {
  if (!pool) return;
  try {
    await pool.query(
      `insert into tk_audit_log (action, row_table, row_id, before, after, user_email, meta)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb)`,
      [
        entry.action,
        entry.row_table || null,
        entry.row_id || null,
        JSON.stringify(entry.before || {}),
        JSON.stringify(entry.after || {}),
        entry.user_email || null,
        JSON.stringify(entry.meta || {}),
      ],
    );
  } catch (e) {
    (logger || console).warn?.({ err: e?.message }, "[traktime] audit insert failed");
  }
}
