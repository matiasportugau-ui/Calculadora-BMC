/**
 * IMP-14 — Capability tiers for AGENT_TOOLS (MCP/GPT safe exposure).
 *
 * quote  — calc / catalog / read-only quote math
 * crm    — CRM / WA / follow-up (often HITL)
 * ops    — wolfboard / sheets / traktime / admin-ish
 * email  — email tools
 * meta   — bugs / misc
 */

/** @type {Record<string, 'quote'|'crm'|'ops'|'email'|'meta'>} */
const TIER_BY_NAME = {
  calcular_cotizacion: "quote",
  obtener_precio_panel: "quote",
  listar_opciones_panel: "quote",
  get_calc_state: "quote",
  generar_pdf: "quote",
  obtener_escenarios: "quote",
  obtener_catalogo: "quote",
  obtener_informe_completo: "quote",
  presupuesto_libre: "quote",
  listar_cotizaciones_recientes: "quote",
  obtener_cotizacion_por_id: "quote",
  aplicar_estado_calc: "quote",
  comparar_listas: "quote",
  comparar_escenarios: "quote",
  cancelar_cotizacion: "quote",
  obtener_pdf_html: "quote",
  recuperar_casos_similares: "quote",
  formatear_resumen_crm: "crm",
  guardar_en_crm: "crm",
  buscar_cliente_crm: "crm",
  enviar_whatsapp_link: "crm",
  programar_seguimiento: "crm",
  historial_cliente: "crm",
  leer_crm_taxonomia: "crm",
  escribir_crm_taxonomia: "crm",
  wa_lead_to_admin: "crm",
  wolfboard_pendientes: "ops",
  wolfboard_export: "ops",
  wolfboard_sync: "ops",
  wolfboard_actualizar_fila: "ops",
  wolfboard_marcar_enviado: "ops",
  wolfboard_quote_batch: "ops",
  list_bug_reports: "meta",
  email_panelsim_resumen: "email",
  email_borrador_saliente: "email",
  email_listar_hilos: "email",
  email_leer_hilo: "email",
  email_clasificar_mensaje: "email",
  email_enviar: "email",
  traktime_timer_current: "ops",
  traktime_timer_start: "ops",
  traktime_timer_stop: "ops",
  traktime_list_entries: "ops",
  traktime_create_entry: "ops",
  traktime_day_report: "ops",
  traktime_month_report: "ops",
  traktime_billable_report: "ops",
  traktime_suggest_entry: "ops",
  traktime_activity_today: "ops",
  sheets_list_tabs: "ops",
  sheets_read_range: "ops",
  sheets_find: "ops",
  sheets_get_pending_admin: "ops",
  sheets_propose_write: "ops",
  sheets_write_range: "ops",
};

export const TOOL_TIERS = ["quote", "crm", "ops", "email", "meta"];

/**
 * @param {string} name
 * @returns {'quote'|'crm'|'ops'|'email'|'meta'}
 */
export function getToolTier(name) {
  return TIER_BY_NAME[name] || "meta";
}

/**
 * @param {Array<{name:string}>} tools
 * @param {string|null|undefined} tierFilter comma-separated tiers
 */
export function filterToolsByTier(tools, tierFilter) {
  if (!tierFilter || !String(tierFilter).trim()) return tools;
  const want = new Set(
    String(tierFilter)
      .split(/[,;|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!want.size) return tools;
  return tools.filter((t) => want.has(getToolTier(t.name)));
}
