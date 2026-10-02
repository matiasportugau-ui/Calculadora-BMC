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
 *  - Unique channel keys (wa_phone / ml_user_id / chrome_ext_contact_id) are
 *    cleared on the loser and COALESCE'd onto the winner when the winner's
 *    field is null — matching docs/transformation/05-identity-resolution.md
 *    ("Union onto survivor"). Leaving them on the loser made post-merge
 *    inbound resolve to a Contactos-Unificados-hidden row (thread split) and
 *    blocked hand-editing those keys onto the winner (UNIQUE still held).
 *    integration_uuid stays on the loser (NOT NULL); resolveContact follows
 *    merged_into when inbound still matches that uuid.
 *
 * MAINTENANCE NOTE — repoint list: the repoint step below currently knows
 * about exactly two FKs into omni_contacts (omni_conversations.contact_id,
 * omni_deals.contact_id — the only two as of migration 013). If a future
 * migration adds another `... REFERENCES omni_contacts(id)` table, that
 * migration MUST also add a repoint UPDATE here, or rows in the new table
 * would silently keep pointing at the archived loser contact after a merge.
 *
 * MAINTENANCE NOTE — this is mechanism only, not policy: mergeContacts()
 * itself does not check the caller's role/permissions — POST /omni/contacts/
 * merge (server/routes/omni.js) is what gates this behind requireGrant.admin
 * ("canales"). Any new caller (e.g. a future automation/worker) is
 * responsible for re-deriving that same admin gate; this function will not
 * enforce it for you.
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
      `SELECT id, name, email, phone, wa_phone, ml_user_id, chrome_ext_contact_id
         FROM omni_contacts WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [[fromId, intoId]],
    );
    const byId = new Map(locked.map((r) => [r.id, r]));
    if (!byId.has(fromId) || !byId.has(intoId)) {
      throw new ContactMergeError("contact_not_found", "one or both contacts do not exist");
    }
    const fromRow = byId.get(fromId);

    const convResult = await client.query(
      `UPDATE omni_conversations SET contact_id = $2, updated_at = now() WHERE contact_id = $1`,
      [fromId, intoId],
    );
    const dealsResult = await client.query(
      `UPDATE omni_deals SET contact_id = $2, updated_at = now() WHERE contact_id = $1`,
      [fromId, intoId],
    );

    // Free UNIQUE keys on the loser first so the winner can absorb them.
    await client.query(
      `UPDATE omni_contacts
          SET wa_phone = NULL,
              ml_user_id = NULL,
              chrome_ext_contact_id = NULL,
              properties = jsonb_set(COALESCE(properties, '{}'::jsonb), '{merged_into}', to_jsonb($2::text)),
              updated_at = now()
        WHERE id = $1`,
      [fromId, intoId],
    );

    // Union channel identity + blank profile fields onto the survivor.
    await client.query(
      `UPDATE omni_contacts
          SET wa_phone = COALESCE(wa_phone, $2),
              ml_user_id = COALESCE(ml_user_id, $3),
              chrome_ext_contact_id = COALESCE(chrome_ext_contact_id, $4),
              email = COALESCE(email, $5),
              phone = COALESCE(phone, $6),
              name = COALESCE(name, $7),
              updated_at = now()
        WHERE id = $1`,
      [
        intoId,
        fromRow.wa_phone || null,
        fromRow.ml_user_id ?? null,
        fromRow.chrome_ext_contact_id || null,
        fromRow.email || null,
        fromRow.phone || null,
        fromRow.name || null,
      ],
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
