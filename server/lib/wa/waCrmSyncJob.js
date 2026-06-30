/**
 * `wa_crm_sync` durable omni job (OMNI_WA_CANONICAL ON).
 *
 * Replaces the legacy in-memory `processWaConversation` side-effects with a job on
 * the omni_ai_jobs queue. INSERT-ONCE semantics: if a CRM_Operativo lead row
 * already exists for this phone, the job skips parse + all Sheets writes — it never
 * overwrites an operator-edited row (Estado/Observaciones/Bloquear-auto). It
 * deliberately does NOT generate the AF–AG AI reply — under canonical mode the
 * single Omni `suggest` job is the only AI call (decision #4 in the plan).
 *
 * Coalescing (one non-terminal job per conversation) is enforced by the partial
 * unique index in migration 011, so per-message events collapse onto one create.
 */
import { writeWaCrmIngest, runWaAutoLearn, findCrmRowByPhone } from "./crmIngestWrite.js";

// Single global key so all wa_crm_sync creates serialize their first-empty-row
// append (two new leads must never grab the same CRM_Operativo row).
const WA_CRM_APPEND_LOCK_KEY = 728199;

/**
 * Run `fn` while holding a global pg advisory lock that serializes CRM appends
 * across worker instances. Falls back to running `fn` directly when the pool has
 * no .connect (offline tests).
 */
async function withCrmAppendLock(pool, fn) {
  if (!pool || typeof pool.connect !== "function") return fn();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [WA_CRM_APPEND_LOCK_KEY]);
    return await fn();
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [WA_CRM_APPEND_LOCK_KEY]);
    } catch {
      /* best-effort unlock */
    }
    client.release();
  }
}

/**
 * @param {object} args
 * @param {import('pg').Pool} args.pool
 * @param {{ conversation_id: string }} args.jobRow
 * @param {object} args.config
 * @param {object} [args.logger]
 * @param {Function} [args.fetchImpl]  injectable fetch (tests)
 * @param {object} [args.sheets]       injectable Sheets client (tests)
 * @returns {Promise<{skipped?:boolean, reason?:string, crm_row?:number|null, form_row?:number|null}>}
 */
export async function runWaCrmSyncJob({ pool, jobRow, config, logger, fetchImpl, sheets }) {
  const doFetch = fetchImpl || fetch;

  const { rows } = await pool.query(
    `SELECT m.sender, m.body, m.created_at,
            c.channel_conversation_id, ct.name AS contact_name
       FROM omni_messages m
       JOIN omni_conversations c ON c.id = m.conversation_id
       LEFT JOIN omni_contacts ct ON ct.id = c.contact_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC`,
    [jobRow.conversation_id],
  );
  if (!rows.length) return { skipped: true, reason: "no_messages" };

  const chatId = rows[0].channel_conversation_id;
  const contactName = rows[0].contact_name || chatId;

  // Insert-once gate (keyed on the STABLE chatId, not the LLM-extracted phone): if a
  // CRM lead already exists for this phone, do NOT re-parse or re-write. This avoids
  // clobbering operator edits AND the per-message parse-conversation LLM cost.
  const existing = await findCrmRowByPhone({ config, phone: chatId, sheets });
  if (existing.skipped) return { skipped: true, reason: existing.reason };
  if (existing.row) {
    logger?.info?.(`[WA] wa_crm_sync skip — CRM row ${existing.row} exists for ${chatId}`);
    return { skipped: true, reason: "crm_row_exists", crm_row: existing.row };
  }
  const sheetsClient = existing.sheets || sheets; // reuse the resolved client

  // Rebuild the transcript in the `HH:MM - name: text` shape parse-conversation expects.
  const dialogo = rows
    .map((r) => {
      const hhmm = new Date(r.created_at).toISOString().slice(11, 16);
      const who = r.sender === "customer" ? contactName : "Agente";
      return `${hhmm} - ${who}: ${r.body}`;
    })
    .join("\n");

  const parseResp = await doFetch(
    `http://localhost:${config.port}/api/crm/parse-conversation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dialogo }),
    },
  );
  // Transient failure (e.g. 503 — all LLM providers momentarily down): throw so the
  // worker marks the job failed and RETRIES it (up to attempts→dead), instead of
  // silently finalizing with no CRM row. A genuine 200-but-unparseable response won't
  // improve on retry, so that path skips cleanly below.
  if (!parseResp.ok) {
    throw new Error(`parse_conversation_http_${parseResp.status}`);
  }
  const parsed = await parseResp.json().catch(() => ({}));
  if (!parsed.ok || !parsed.data) return { skipped: true, reason: "parse_unparseable" };

  // Create under the global append lock, re-checking existence inside it so a
  // concurrent create for the same phone can't produce a duplicate row.
  const ingest = await withCrmAppendLock(pool, async () => {
    const recheck = await findCrmRowByPhone({ config, phone: chatId, sheets: sheetsClient });
    if (recheck.row) return { skipped: true, reason: "crm_row_exists", crmRow: recheck.row };
    return writeWaCrmIngest({
      parsedData: parsed.data,
      chatId,
      dialogo,
      config,
      logger,
      sheets: sheetsClient,
    });
  });

  // Auto-learn only on a genuine new lead (matches the per-burst legacy cadence,
  // and avoids re-learning the same conversation on every message).
  if (!ingest.skipped) {
    const turns = rows.map((r) => ({
      role: r.sender === "customer" ? "user" : "assistant",
      content: r.body,
    }));
    await runWaAutoLearn({ turns, chatId, logger });
  }

  return {
    skipped: ingest.skipped ?? false,
    reason: ingest.reason,
    crm_row: ingest.crmRow ?? null,
    form_row: ingest.formRow ?? null,
  };
}
