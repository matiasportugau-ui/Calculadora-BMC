/**
 * Voice-safe default denylist for high-risk write tools.
 * Full AGENT_TOOLS surface is registered when PANELI_MCP_ALLOW_WRITES=1
 * (minus explicit PANELI_MCP_DENY_TOOLS).
 */

/** High-risk mutations — denied unless PANELI_MCP_ALLOW_WRITES=1 */
export const DEFAULT_WRITE_DENY = Object.freeze([
  "guardar_en_crm",
  "enviar_whatsapp_link",
  "cancelar_cotizacion",
  "programar_seguimiento",
  "escribir_crm_taxonomia",
  "wa_lead_to_admin",
  "wolfboard_sync",
  "wolfboard_actualizar_fila",
  "wolfboard_marcar_enviado",
  "wolfboard_quote_batch",
  "email_enviar",
  "sheets_write_range",
  "traktime_timer_start",
  "traktime_timer_stop",
  "traktime_create_entry",
  "traktime_update_entry",
  "traktime_delete_entry",
]);

function parseCsv(envVal) {
  return String(envVal || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @returns {{ denied: Set<string>, allowWrites: boolean }}
 */
export function resolveDenyList() {
  const allowWrites = /^(1|true|yes)$/i.test(
    String(process.env.PANELI_MCP_ALLOW_WRITES || ""),
  );
  const extra = parseCsv(process.env.PANELI_MCP_DENY_TOOLS);
  const denied = new Set(extra);
  if (!allowWrites) {
    for (const name of DEFAULT_WRITE_DENY) denied.add(name);
  }
  return { denied, allowWrites };
}
