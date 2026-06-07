// ═══════════════════════════════════════════════════════════════════════════
// Cliente para /api/team-assist — asistente equipo (OpenAI vía servidor)
// Migrado al apiClient central: resolución de base URL, headers (x-api-key),
// timeout y manejo de errores ahora son consistentes con el resto de la app.
// ═══════════════════════════════════════════════════════════════════════════

import { apiGet, apiPost, ApiError } from "./apiClient.js";

export const TEAM_ASSIST_CHAT_TIMEOUT_MS = 40_000;

export async function fetchTeamAssistHealth() {
  // Health devuelve el body aún cuando el endpoint reporte un estado no-ok.
  try {
    const { data } = await apiGet("/api/team-assist/health");
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.data) return err.data;
    throw err;
  }
}

/**
 * @param {{ agentId: string, messages: { role: string, content: string }[], context?: object }} body
 */
export async function fetchTeamAssistChat(body) {
  // The server gives OpenAI up to 30s before returning its own 504. Keep the
  // client timeout above that so slow-but-valid responses are not aborted early.
  const { data } = await apiPost("/api/team-assist/chat", body, {
    timeoutMs: TEAM_ASSIST_CHAT_TIMEOUT_MS,
  });
  return data;
}
