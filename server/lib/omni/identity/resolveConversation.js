/**
 * Identity resolution — conversation lookup / create per channel thread.
 */

/**
 * @param {import("pg").PoolClient} client
 * @param {{
 *   contact_id: string;
 *   channel: string;
 *   conversation_hint: { channel_conversation_id: string; subject?: string };
 *   source?: string;
 * }} args
 */
export async function resolveConversation(client, {
  contact_id,
  channel,
  conversation_hint,
  source,
}) {
  const channelConversationId = String(conversation_hint.channel_conversation_id).slice(0, 255);
  const subject = conversation_hint.subject
    ? String(conversation_hint.subject).slice(0, 512)
    : null;

  async function loadExisting() {
    const { rows } = await client.query(
      `SELECT id FROM omni_conversations
       WHERE contact_id = $1 AND channel = $2 AND channel_conversation_id = $3
       LIMIT 1`,
      [contact_id, channel, channelConversationId],
    );
    return rows[0] || null;
  }

  const existing = await loadExisting();
  if (existing) {
    if (subject) {
      await client.query(
        `UPDATE omni_conversations SET subject = COALESCE(subject, $2), updated_at = now()
         WHERE id = $1`,
        [existing.id, subject],
      );
    }
    return { conversation_id: existing.id, created: false, contact_id };
  }

  const properties = source ? { last_ingest_source: source } : {};
  // UNIQUE (contact_id, channel, channel_conversation_id) — concurrent first
  // messages for a new thread (Meta webhook Promise.all, dual shadow writes)
  // must not abort the txn and drop the inbound. Mirror resolveContact:
  // ON CONFLICT DO NOTHING + re-select the winner.
  const ins = await client.query(
    `INSERT INTO omni_conversations
       (contact_id, channel, channel_conversation_id, subject, status, properties)
     VALUES ($1, $2, $3, $4, 'open', $5::jsonb)
     ON CONFLICT (contact_id, channel, channel_conversation_id) DO NOTHING
     RETURNING id`,
    [contact_id, channel, channelConversationId, subject, JSON.stringify(properties)],
  );
  if (ins.rows[0]) {
    return { conversation_id: ins.rows[0].id, created: true, contact_id };
  }

  const after = await loadExisting();
  if (after) {
    if (subject) {
      await client.query(
        `UPDATE omni_conversations SET subject = COALESCE(subject, $2), updated_at = now()
         WHERE id = $1`,
        [after.id, subject],
      );
    }
    return { conversation_id: after.id, created: false, contact_id };
  }
  throw new Error("resolveConversation: insert conflicted but conversation not found on re-resolve");
}
