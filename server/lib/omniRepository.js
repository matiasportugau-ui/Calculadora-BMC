/**
 * Persistencia omnicanal (Postgres).
 * @param {import("pg").Pool} pool
 */

const VALID_MODES = new Set(["off", "listen", "auto"]);

/**
 * @param {string} raw
 * @param {string} fallback
 */
export function normalizeOmniMode(raw, fallback = "listen") {
  const m = String(raw || "").toLowerCase();
  return VALID_MODES.has(m) ? m : fallback;
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} opts
 * @param {'whatsapp'|'messenger'|'instagram'} opts.channel
 * @param {string} opts.externalThreadId
 * @param {string} [opts.contactName]
 * @param {string} opts.defaultMode
 */
export async function upsertOmniThread(pool, { channel, externalThreadId, contactName, defaultMode }) {
  const mode = normalizeOmniMode(defaultMode, "listen");
  const { rows } = await pool.query(
    `insert into omni_threads (channel, external_thread_id, contact_name, mode, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (channel, external_thread_id) do update set
       contact_name = coalesce(excluded.contact_name, omni_threads.contact_name),
       updated_at = now()
     returning id, last_flushed_message_id, mode, human_active_until`,
    [channel, externalThreadId, contactName || null, mode],
  );
  return rows[0];
}

/**
 * @returns {Promise<{ skipped: true } | { messageId: number, threadId: number, thread: object }>}
 */
export async function insertOmniMessageIfNew(pool, opts) {
  const {
    channel,
    externalMessageId,
    threadId,
    direction = "inbound",
    bodyText,
    rawPayload,
    consultaTipo,
    classificationScore,
  } = opts;

  try {
    const { rows } = await pool.query(
      `insert into omni_messages (thread_id, channel, external_message_id, direction, body_text, raw_payload, consulta_tipo, classification_score)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       returning id, thread_id`,
      [
        threadId,
        channel,
        externalMessageId,
        direction,
        bodyText ?? null,
        rawPayload ? JSON.stringify(rawPayload) : null,
        consultaTipo ?? null,
        classificationScore ?? null,
      ],
    );
    const row = rows[0];
    await pool.query(
      `update omni_threads set last_message_at = now(), pending_flush = true, updated_at = now() where id = $1`,
      [threadId],
    );
    const thr = await pool.query(`select id, last_flushed_message_id, mode, human_active_until from omni_threads where id = $1`, [
      threadId,
    ]);
    return { messageId: row.id, threadId: row.thread_id, thread: thr.rows[0] };
  } catch (e) {
    if (e && e.code === "23505") return { skipped: true };
    throw e;
  }
}

export async function insertOmniAttachment(pool, { messageId, mediaKind, whatsappMediaId }) {
  const { rows } = await pool.query(
    `insert into omni_attachments (message_id, media_kind, whatsapp_media_id, processing_status)
     values ($1, $2, $3, 'pending')
     returning id`,
    [messageId, mediaKind, whatsappMediaId || null],
  );
  return rows[0]?.id;
}

export async function enqueueOmniOutbox(pool, jobType, payload) {
  await pool.query(`insert into omni_outbox (job_type, payload, status, next_run_at) values ($1, $2::jsonb, 'pending', now())`, [
    jobType,
    JSON.stringify(payload || {}),
  ]);
}

export async function fetchMessagesAfterFlushCursor(pool, threadId, lastFlushedMessageId) {
  const { rows } = await pool.query(
    `select m.id, m.body_text, m.received_at, m.consulta_tipo,
            (select string_agg(trim(oa.extracted_text), ' ')
             from omni_attachments oa
             where oa.message_id = m.id and oa.extracted_text is not null and trim(oa.extracted_text) <> '') as attachment_text
     from omni_messages m
     where m.thread_id = $1 and m.id > $2 and m.direction = 'inbound'
     order by m.id asc`,
    [threadId, lastFlushedMessageId],
  );
  return rows;
}

export async function markThreadFlushed(pool, threadId, lastMessageId) {
  await pool.query(
    `update omni_threads set last_flushed_message_id = $2, pending_flush = false, updated_at = now() where id = $1`,
    [threadId, lastMessageId],
  );
}

export async function getThreadByChannelExternal(pool, channel, externalThreadId) {
  const { rows } = await pool.query(`select * from omni_threads where channel = $1 and external_thread_id = $2`, [
    channel,
    externalThreadId,
  ]);
  return rows[0] || null;
}

export async function listThreadsPendingFlush(pool, inactivityMs) {
  const { rows } = await pool.query(
    `select id, channel, external_thread_id, contact_name, last_message_at, last_flushed_message_id, mode
     from omni_threads
     where pending_flush = true
       and last_message_at is not null
       and last_message_at < now() - ($1::bigint * interval '1 millisecond')`,
    [inactivityMs],
  );
  return rows;
}

/**
 * Reglas ligeras + opción LLM después (Fase F).
 * @param {string} text
 */
export function classifyInboundTextHeuristic(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return { consulta_tipo: "general", classification_score: 0.3 };
  if (/precio|cotiz|cuánto|cuanto|stock|disponible|lista/i.test(t)) return { consulta_tipo: "precio_stock", classification_score: 0.75 };
  if (/reclamo|mal|devol|queja/i.test(t)) return { consulta_tipo: "reclamo", classification_score: 0.8 };
  if (t.length < 8 && /^(hola|buenas|ok|gracias|👍|🚀)$/i.test(t.trim())) return { consulta_tipo: "general", classification_score: 0.5 };
  return { consulta_tipo: "general", classification_score: 0.55 };
}

export async function updateMessageClassification(pool, messageId, consultaTipo, score) {
  await pool.query(`update omni_messages set consulta_tipo = $2, classification_score = $3 where id = $1`, [
    messageId,
    consultaTipo,
    score,
  ]);
}

export async function getPolicyAllowAuto(pool, consultaTipo) {
  const { rows } = await pool.query(`select allow_auto from omni_policy where consulta_tipo = $1`, [consultaTipo]);
  if (!rows.length) return false;
  return !!rows[0].allow_auto;
}
