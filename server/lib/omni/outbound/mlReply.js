/**
 * Omni outbound — MercadoLibre answer via internal API loopback
 */

import { buildMlWriteHeaders } from "../../mlInternalAuthHeaders.js";

/**
 * @param {{ config: object; questionId: string; text: string }} args
 */
export async function sendMlReply({ config, questionId, text }) {
  const base = String(config.publicBaseUrl || `http://127.0.0.1:${config.port}`).replace(/\/$/, "");
  const res = await fetch(`${base}/ml/questions/${encodeURIComponent(questionId)}/answer`, {
    method: "POST",
    headers: buildMlWriteHeaders(config, { "Content-Type": "application/json" }),
    body: JSON.stringify({ text: String(text).slice(0, 2000) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || "ml_send_failed", status: res.status, data };
  }
  return { ok: true, data };
}
