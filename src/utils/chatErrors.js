/**
 * Maps fetch/HTTP errors to user-friendly Spanish messages for the chat UI.
 * Extracted as a standalone module so it can be unit-tested without React.
 */
export function mapErrorMessage(err) {
  if (err?.name === "AbortError") return null; // intentional stop()
  const status = err?._status;
  if (status === 401) return "Token de desarrollador inválido.";
  if (status === 403) return "Origen no permitido para este servicio.";
  if (status === 429) return "Demasiadas consultas. Esperá un momento.";
  if (status === 503) return "Servicio de IA no disponible en este momento.";
  if (status >= 500) return `Error del servidor (${status}). Intentá de nuevo.`;
  if (err instanceof TypeError || status === 0) {
    return "No se puede conectar con el servidor. Verificá tu conexión.";
  }
  if (status) return `Error ${status}. Intentá de nuevo.`;
  return "No se pudo conectar con Panelin. Intentá de nuevo.";
}
