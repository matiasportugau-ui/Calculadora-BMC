/**
 * Bridge chat `messages` ↔ Grok Realtime conversation items.
 * One store (useChat.messages); Voice seeds the WS from it.
 */

export const HISTORY_SEED_CAP = 20;

function turnText(m) {
  return String(m?.content ?? m?.text ?? "").trim();
}

function isChatRole(m) {
  return m && (m.role === "user" || m.role === "assistant");
}

/**
 * @param {Array<{ role?: string, content?: string, text?: string }>} messages
 * @param {{ cap?: number }} [opts]
 * @returns {Array<{ type: string, item: object }>} conversation.item.create payloads
 */
export function buildHistoryItemCreates(messages, opts = {}) {
  const cap = Number.isFinite(opts.cap) ? opts.cap : HISTORY_SEED_CAP;
  const rows = (Array.isArray(messages) ? messages : [])
    .filter((m) => isChatRole(m) && turnText(m))
    .map((m) => {
      const role = m.role === "assistant" ? "assistant" : "user";
      const text = turnText(m);
      return {
        type: "conversation.item.create",
        item: {
          type: "message",
          role,
          content: [{
            type: role === "assistant" ? "text" : "input_text",
            text,
          }],
        },
      };
    });
  if (rows.length <= cap) return rows;
  const dropped = rows.length - cap;
  const kept = rows.slice(-cap);
  return [
    {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{
          type: "input_text",
          text: `[historial] ${dropped} turnos anteriores omitidos.`,
        }],
      },
    },
    ...kept,
  ];
}

export function lastUserText(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.role === "user") {
      const t = turnText(rows[i]);
      if (t) return t;
    }
  }
  return "";
}
