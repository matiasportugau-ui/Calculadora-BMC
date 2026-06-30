/**
 * server/lib/omni/identity/contactMerge.js — execute a verified-safe contact
 * merge: repoint conversation/deal history from a duplicate ("loser") contact
 * onto the canonical ("winner") contact, inside a single transaction.
 *
 * Safety properties (the reason this is its own reviewed module, not inlined
 * in the route):
 *  - NEVER hard-deletes the loser contact row. omni_contacts -> omni_conversations
 *    and -> omni_deals are both ON DELETE CASCADE (and cascade further into
 *    messages/suggestions/ai_jobs/notes/frt_breaches) — a literal DELETE here
 *    would destroy the very history this function exists to preserve.
 *  - The loser is soft-archived via properties.merged_into (never removed),
 *    and every merge is recorded in omni_contact_merge_log (migration 013)
 *    for audit/undo-by-hand.
 *  - Both contacts are row-locked (SELECT ... FOR UPDATE) for the duration of
 *    the transaction so a concurrent merge touching either side can't interleave.
 *  - Deliberately does NOT copy identity columns (email/phone/wa_phone/
 *    ml_user_id) from loser to winner: wa_phone/ml_user_id are UNIQUE and the
 *    loser still holds its value at update time, so blindly copying it over
 *    risks a unique-constraint conflict for marginal benefit — an operator can
 *    edit the winner's profile by hand afterward if a field is worth keeping.
 */

export class ContactMergeError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "ContactMergeError";
    this.code = code;
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ fromId:string, intoId:string, performedByUserId?:string|null }} args
 * @returns {Promise<{merged_from_id:string, merged_into_id:string,
 *   conversations_repointed:number, deals_repointed:number}>}
 */
export async function mergeContacts(pool, { fromId, intoId, performedByUserId = null }) {
  if (!fromId || !intoId) {
    throw new ContactMergeError("missing_id", "fromId and intoId are required");
  }
  if (fromId === intoId) {
    throw new ContactMergeError("same_contact", "cannot merge a contact into itself");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: locked } = await client.query(
      `SELECT id FROM omni_contacts WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [[fromId, intoId]],
    );
    const lockedIds = new Set(locked.map((r) => r.id));
    if (!lockedIds.has(fromId) || !lockedIds.has(intoId)) {
      throw new ContactMergeError("contact_not_found", "one or both contacts do not exist");
    }

    const convResult = await client.query(
      `UPDATE omni_conversations SET contact_id = $2, updated_at = now() WHERE contact_id = $1`,
      [fromId, intoId],
    );
    const dealsResult = await client.query(
      `UPDATE omni_deals SET contact_id = $2, updated_at = now() WHERE contact_id = $1`,
      [fromId, intoId],
    );

    await client.query(
      `UPDATE omni_contacts
          SET properties = jsonb_set(COALESCE(properties, '{}'::jsonb), '{merged_into}', to_jsonb($2::text)),
              updated_at = now()
        WHERE id = $1`,
      [fromId, intoId],
    );

    await client.query(
      `INSERT INTO omni_contact_merge_log
         (merged_from_id, merged_into_id, performed_by_user_id, conversations_repointed, deals_repointed)
       VALUES ($1, $2, $3, $4, $5)`,
      [fromId, intoId, performedByUserId, convResult.rowCount, dealsResult.rowCount],
    );

    await client.query("COMMIT");

    return {
      merged_from_id: fromId,
      merged_into_id: intoId,
      conversations_repointed: convResult.rowCount,
      deals_repointed: dealsResult.rowCount,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
