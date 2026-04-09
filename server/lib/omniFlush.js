import {
  fetchMessagesAfterFlushCursor,
  markThreadFlushed,
} from "./omniRepository.js";
import { buildDialogoFromRows, syncDialogoToSheets } from "./omniCrmSync.js";

/** @param {'whatsapp'|'messenger'|'instagram'} channel */
export function channelToCrmOrigen(channel) {
  if (channel === "whatsapp") return "WA-Auto";
  if (channel === "messenger") return "FB-Auto";
  return "IG-Auto";
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} config
 * @param {object} logger
 * @param {{ id: number, channel: string, external_thread_id: string, contact_name: string | null, last_flushed_message_id: number }} thread
 * @param {string} [baseUrl]
 */
export async function flushOmniThreadToCrm(pool, config, logger, thread, baseUrl) {
  const rows = await fetchMessagesAfterFlushCursor(pool, thread.id, thread.last_flushed_message_id);
  if (!rows.length) {
    await markThreadFlushed(pool, thread.id, thread.last_flushed_message_id);
    return { ok: true, skipped: true };
  }

  const contact = thread.contact_name || thread.external_thread_id;
  const dialogo = buildDialogoFromRows(rows, contact);
  const origen = channelToCrmOrigen(thread.channel);
  const lastId = rows[rows.length - 1].id;

  const res = await syncDialogoToSheets({
    config,
    logger,
    dialogo,
    externalContactId: thread.external_thread_id,
    origen,
    baseUrl,
  });

  if (res.ok) {
    await markThreadFlushed(pool, thread.id, lastId);
  }
  return res;
}
