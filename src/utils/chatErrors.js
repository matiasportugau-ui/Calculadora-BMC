/**
 * Maps fetch/HTTP errors to user-friendly Spanish messages for the chat UI.
 * Extracted as a standalone module so it can be unit-tested without React.
 */
export function mapErrorMessage(err) {
  if (err?.name === "AbortError") return null; // intentional stop()
  const status = err?._status;
  const serverMsg = String(err?._serverMessage || err?._body?.error || "").trim();
  if (status === 401) {
    return "Token de desarrollador inválido. Tiene que ser el mismo valor que API_AUTH_TOKEN en la API (Cloud Run): sin comillas, espacios ni líneas al pegar. Si cambió el token en el servidor, actualizalo con Ctrl+Shift+D de nuevo.";
  }
  if (status === 403) return "Origen no permitido para este servicio.";
  if (status === 429) return "Demasiadas consultas. Esperá un momento.";
  if (status === 503) return "Servicio de IA no disponible en este momento.";
  if (status === 400 && /historial demasiado largo/i.test(serverMsg)) {
    return "El historial del chat superó 60 mensajes. Usá «Limpiar chat» (icono papelera) y volvé a enviar tu consulta.";
  }
  if (status === 400 && serverMsg) return serverMsg;
  if (status >= 500) return `Error del servidor (${status}). Intentá de nuevo.`;
  if (err instanceof TypeError || status === 0) {
    return "No se puede conectar con el servidor. Verificá tu conexión.";
  }
  if (status) return `Error ${status}. Intentá de nuevo.`;
  return "No se pudo conectar con Panelin. Intentá de nuevo.";
}
