// ═══════════════════════════════════════════════════════════════════════════
// Cliente para /api/team-assist — asistente equipo (OpenAI vía servidor).
// Usa apiClient público (sin auth): el servidor aplica rate limit en POST /chat.
// ═══════════════════════════════════════════════════════════════════════════

import { apiGet, apiPost, ApiError } from "./apiClient.js";

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
  const { data } = await apiPost("/api/team-assist/chat", body);
  return data;
}
