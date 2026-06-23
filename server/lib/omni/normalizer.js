/**
 * Omni normalizer — single ingest entry: dedup → identity → persist.
 */
import { getOmniPool } from "./omniDb.js";
import { parseOmniInboundEvent } from "./types.js";
import { resolveContact } from "./identity/resolveContact.js";
import { resolveConversation } from "./identity/resolveConversation.js";
import { emit } from "./eventBus.js";
import { config as appConfig } from "../../config.js";

/**
 * @param {import("pg").PoolClient} client
 * @param {string} idempotencyKey
 */
async function loadDuplicateResult(client, idempotencyKey) {
  const { rows: dedupRows } = await client.query(
    `SELECT message_id FROM omni_ingest_dedup WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  const messageId = dedupRows[0]?.message_id;
  if (!messageId) return null;

  const msgRow = await client.query(
    `SELECT id, conversation_id FROM omni_messages WHERE id = $1`,
    [messageId],
  );
  const convRow = msgRow.rows[0]
    ? await client.query(
        `SELECT contact_id FROM omni_conversations WHERE id = $1`,
        [msgRow.rows[0].conversation_id],
      )
    : { rows: [] };

  return {
    duplicate: true,
    message_id: messageId,
    conversation_id: msgRow.rows[0]?.conversation_id ?? null,
    contact_id: convRow.rows[0]?.contact_id ?? null,
  };
}

/**
 * @param {import("./types.js").OmniInboundEvent | object} rawEvent
 * @param {{ databaseUrl?: string; logger?: { warn?: Function; info?: Function } }} [opts]
 */
export async function normalizeAndPersist(rawEvent, opts = {}) {
  const parsed = parseOmniInboundEvent(rawEvent);
  if (!parsed.success) {
    const err = new Error("invalid_omni_inbound_event");
    err.details = parsed.error.flatten();
    throw err;
  }
  const event = parsed.data;
  const databaseUrl = opts.databaseUrl;
  const pool = getOmniPool(databaseUrl);
  if (!pool) {
    const err = new Error("omni_db_unavailable");
    err.code = "OMNI_DB_UNAVAILABLE";
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO omni_ingest_dedup (idempotency_key, channel, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [event.idempotency_key, event.channel, event.source],
    );

    const { rows: lockedDedup } = await client.query(
      `SELECT message_id FROM omni_ingest_dedup WHERE idempotency_key = $1 FOR UPDATE`,
      [event.idempotency_key],
    );

    if (!lockedDedup[0]) {
      throw new Error("omni_dedup_row_missing");
    }

    if (lockedDedup[0].message_id) {
      const dup = await loadDuplicateResult(client, event.idempotency_key);
      await client.query("COMMIT");
      return { ...dup, trace_id: event.trace_id ?? null };
    }

    const contact = await resolveContact(client, {
      contact_hint: event.contact_hint,
      channel: event.channel,
      source: event.source,
    });

    const conversation = await resolveConversation(client, {
      contact_id: contact.contact_id,
      channel: event.channel,
      conversation_hint: event.conversation_hint,
      source: event.source,
    });

    const occurredAt = event.occurred_at || new Date().toISOString();
    const metadata = {
      ...(event.message.metadata || {}),
      source: event.source,
      idempotency_key: event.idempotency_key,
      side_effects: event.side_effects || null,
      trace_id: event.trace_id || null,
    };

    const msgIns = await client.query(
      `INSERT INTO omni_messages
         (conversation_id, sender, sender_id, body, attachments, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::timestamptz)
       RETURNING id`,
      [
        conversation.conversation_id,
        event.message.sender,
        event.message.sender_id || null,
        event.message.body,
        JSON.stringify(event.message.attachments || []),
        JSON.stringify(metadata),
        occurredAt,
      ],
    );

    const messageId = msgIns.rows[0].id;

    await client.query(
      `UPDATE omni_ingest_dedup SET message_id = $2 WHERE idempotency_key = $1`,
      [event.idempotency_key, messageId],
    );

    await client.query(
      `UPDATE omni_conversations SET updated_at = now() WHERE id = $1`,
      [conversation.conversation_id],
    );

    await client.query("COMMIT");

    const result = {
      duplicate: false,
      contact_id: conversation.contact_id || contact.contact_id,
      conversation_id: conversation.conversation_id,
      message_id: messageId,
      contact_created: contact.created,
      conversation_created: conversation.created,
      trace_id: event.trace_id ?? null,
      channel: event.channel,
      source: event.source,
      message: event.message,
    };

    if (appConfig.omniEventBusEnabled) {
      await emit("message.ingested", {
        ...result,
        body: event.message.body,
        logger: opts.logger,
      });
    }

    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Fire-and-forget shadow write — never throws to caller.
 * @param {object} event
 * @param {{ databaseUrl?: string; logger?: object }} opts
 */
export async function shadowPersist(event, opts = {}) {
  try {
    return await normalizeAndPersist(event, opts);
  } catch (e) {
    opts.logger?.warn?.(
      { err: e?.message, idempotency_key: event?.idempotency_key },
      "omni shadow persist failed",
    );
    return null;
  }
}
