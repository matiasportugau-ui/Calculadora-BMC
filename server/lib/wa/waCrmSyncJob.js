/**
 * `wa_crm_sync` durable omni job (OMNI_WA_CANONICAL ON).
 *
 * Replaces the legacy in-memory `processWaConversation` side-effects with a job on
 * the omni_ai_jobs queue: load the whole conversation, parse it, and upsert ONE
 * CRM_Operativo row per phone + run auto-learn. It deliberately does NOT generate
 * the AF–AG AI reply — under canonical mode the single Omni `suggest` job is the
 * only AI call (decision #4 in the plan).
 *
 * Coalescing (one pending job per conversation) is enforced by the partial unique
 * index added in migration 011, so per-message events collapse onto one CRM write.
 */
import { writeWaCrmIngest, runWaAutoLearn } from "./crmIngestWrite.js";

/**
 * @param {object} args
 * @param {import('pg').Pool} args.pool
 * @param {{ conversation_id: string }} args.jobRow
 * @param {object} args.config
 * @param {object} [args.logger]
 * @param {Function} [args.fetchImpl]  injectable fetch (tests)
 * @returns {Promise<{skipped?:boolean, reason?:string, crm_row?:number|null, form_row?:number|null}>}
 */
export async function runWaCrmSyncJob({ pool, jobRow, config, logger, fetchImpl }) {
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
  const parsed = await parseResp.json().catch(() => ({}));
  if (!parsed.ok || !parsed.data) return { skipped: true, reason: "parse_failed" };

  const ingest = await writeWaCrmIngest({
    parsedData: parsed.data,
    chatId,
    dialogo,
    config,
    logger,
    findRow: "upsertByPhone",
  });

  const turns = rows.map((r) => ({
    role: r.sender === "customer" ? "user" : "assistant",
    content: r.body,
  }));
  await runWaAutoLearn({ turns, chatId, logger });

  return {
    skipped: ingest.skipped ?? false,
    reason: ingest.reason,
    crm_row: ingest.crmRow ?? null,
    form_row: ingest.formRow ?? null,
  };
}
