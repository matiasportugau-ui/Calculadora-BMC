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

  // Agent replies / mirrors may omit contact_hint — reuse existing thread by channel id.
  const { rows: globalRows } = await client.query(
    `SELECT id, contact_id FROM omni_conversations
     WHERE channel = $1 AND channel_conversation_id = $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [channel, channelConversationId],
  );

  if (globalRows[0]) {
    if (subject) {
      await client.query(
        `UPDATE omni_conversations SET subject = COALESCE(subject, $2), updated_at = now()
         WHERE id = $1`,
        [globalRows[0].id, subject],
      );
    }
    return {
      conversation_id: globalRows[0].id,
      created: false,
      contact_id: globalRows[0].contact_id,
    };
  }

  const { rows } = await client.query(
    `SELECT id FROM omni_conversations
     WHERE contact_id = $1 AND channel = $2 AND channel_conversation_id = $3
     LIMIT 1`,
    [contact_id, channel, channelConversationId],
  );

  if (rows[0]) {
    if (subject) {
      await client.query(
        `UPDATE omni_conversations SET subject = COALESCE(subject, $2), updated_at = now()
         WHERE id = $1`,
        [rows[0].id, subject],
      );
    }
    return { conversation_id: rows[0].id, created: false };
  }

  const properties = source ? { last_ingest_source: source } : {};
  const ins = await client.query(
    `INSERT INTO omni_conversations
       (contact_id, channel, channel_conversation_id, subject, status, properties)
     VALUES ($1, $2, $3, $4, 'open', $5::jsonb)
     RETURNING id`,
    [contact_id, channel, channelConversationId, subject, JSON.stringify(properties)],
  );
  return { conversation_id: ins.rows[0].id, created: true };
}
