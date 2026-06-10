// ═══════════════════════════════════════════════════════════════════════════
// Cliente para /api/team-assist — asistente equipo (OpenAI vía servidor)
// Migrado al apiClient central: resolución de base URL, headers (x-api-key),
// timeout y manejo de errores ahora son consistentes con el resto de la app.
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
  const { data } = await apiPost("/api/team-assist/chat", body, { requireApiKey: true });
  return data;
}
