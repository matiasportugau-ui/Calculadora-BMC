// ═══════════════════════════════════════════════════════════════════════════
// Cliente para /api/team-assist — asistente equipo (OpenAI vía servidor)
// ═══════════════════════════════════════════════════════════════════════════

const API_KEY = import.meta.env.VITE_API_AUTH_TOKEN || "";

function headersJson() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

export async function fetchTeamAssistHealth() {
  const res = await fetch("/api/team-assist/health", { headers: headersJson() });
  return res.json();
}

/**
 * @param {{ agentId: string, messages: { role: string, content: string }[], context?: object }} body
 */
export async function fetchTeamAssistChat(body) {
  const res = await fetch("/api/team-assist/chat", {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
