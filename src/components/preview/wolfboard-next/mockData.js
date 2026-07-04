// Mock data for the /preview/wolfboard-next prototype.
// Shapes mirror the REAL endpoints so promoting to live data is a direct swap:
// - /api/assistants/status  → ASSISTANTS
// - /api/kpi-financiero     → FINANZAS (byPeriod/byCurrency/calendar/pendingPayments)
// - proposed /api/ai/usage  → AI_USAGE
// - proposed /api/ai/keys   → AI_KEYS

export const ASSISTANTS = [
  { key: "canales", label: "Canales · Copilot", enabled: true, status: "live", activeProvider: "claude", providersAvailable: ["claude", "gemini", "grok", "openai"], fallbackTo: "seam", deps: "Omni DB ok" },
  { key: "ml", label: "MercadoLibre · Suggest", enabled: true, status: "live", activeProvider: "gemini", providersAvailable: ["claude", "gemini", "grok", "openai"], fallbackTo: "seam", deps: "ML secret ok" },
  { key: "panelin", label: "Panelin · Chat", enabled: false, status: "disabled", activeProvider: null, providersAvailable: ["claude", "gemini"], fallbackTo: "seam", deps: "—" },
  { key: "email", label: "Email Agent", enabled: false, status: "disabled", activeProvider: null, providersAvailable: [], fallbackTo: "seam", deps: "Chatwoot incompleto" },
  { key: "wa", label: "WhatsApp · Suggestions", enabled: false, status: "disabled", activeProvider: null, providersAvailable: ["claude"], fallbackTo: "seam", deps: "DB ok" },
  { key: "wolfboard", label: "Wolfboard · Batch", enabled: false, status: "disabled", activeProvider: null, providersAvailable: ["claude"], fallbackTo: "seam", deps: "—" },
  { key: "seam", label: "Seam (agentCore)", enabled: true, status: "live", activeProvider: "claude", providersAvailable: ["claude", "gemini", "grok", "openai"], fallbackTo: null, deps: "always-on" },
];

export const PROVIDER_COOLDOWNS = [
  { provider: "grok", failures: 3, cooldownUntil: "hace 40 s", reason: "timeout 30s ×3" },
];

export const AI_KEYS = [
  { name: "ANTHROPIC_API_KEY", provider: "Anthropic (Claude)", present: true, last4: "Xk2a", lastUsed: "hace 4 min", source: "GSM · chatbot-bmc-live" },
  { name: "GEMINI_API_KEY", provider: "Google (Gemini)", present: true, last4: "9QzP", lastUsed: "hace 11 min", source: "GSM · chatbot-bmc-live" },
  { name: "GROK_API_KEY", provider: "xAI (Grok)", present: true, last4: "mm01", lastUsed: "hace 2 h (cooldown)", source: "GSM · chatbot-bmc-live" },
  { name: "OPENAI_API_KEY", provider: "OpenAI", present: true, last4: "T7ww", lastUsed: "ayer 22:10", source: "GSM · chatbot-bmc-live" },
  { name: "ML_CLIENT_SECRET", provider: "MercadoLibre OAuth", present: true, last4: "b3f9", lastUsed: "hace 9 min", source: "GSM · chatbot-bmc-live" },
  { name: "WHATSAPP_ACCESS_TOKEN", provider: "Meta WhatsApp Cloud", present: true, last4: "AaZ4", lastUsed: "hace 1 min", source: "GSM · chatbot-bmc-live" },
];

// Proposed ai_usage_events aggregates (per assistant × provider).
export const AI_USAGE = {
  budgetUsd: 50,
  today: { costUsd: 3.84, inputTokens: 412000, outputTokens: 96500, calls: 214 },
  week: { costUsd: 21.4, inputTokens: 2310000, outputTokens: 540000, calls: 1290 },
  month: { costUsd: 78.9, inputTokens: 8950000, outputTokens: 2020000, calls: 5120 },
  rows: [
    { assistant: "canales", provider: "claude", calls: 96, inputTokens: 210000, outputTokens: 52000, costUsd: 1.92 },
    { assistant: "ml", provider: "gemini", calls: 74, inputTokens: 130000, outputTokens: 28000, costUsd: 0.61 },
    { assistant: "ml", provider: "claude", calls: 12, inputTokens: 41000, outputTokens: 9500, costUsd: 0.55 },
    { assistant: "seam", provider: "claude", calls: 18, inputTokens: 22000, outputTokens: 5200, costUsd: 0.38 },
    { assistant: "wa_crm_sync", provider: "gemini", calls: 14, inputTokens: 9000, outputTokens: 1800, costUsd: 0.38 },
  ],
  daily: [
    { day: "28/6", costUsd: 2.1 }, { day: "29/6", costUsd: 3.4 }, { day: "30/6", costUsd: 4.9 },
    { day: "1/7", costUsd: 2.8 }, { day: "2/7", costUsd: 3.1 }, { day: "3/7", costUsd: 1.3 },
    { day: "4/7", costUsd: 3.84 },
  ],
};

// Shape mirrors /api/kpi-financiero byPeriod/byCurrency + aging derived from pendingPayments.
export const FINANZAS = {
  byPeriod: { estaSemana: 4180, proximaSemana: 2350, esteMes: 9660, total: 19318 },
  byCurrency: {
    UES: { label: "U$S", total: 16400, vencido: 11020 },
    $: { label: "$", total: 2918, vencido: 2918 },
  },
  aging: [
    { bucket: "0–30 días", amountUsd: 5290, count: 6, tone: "ok" },
    { bucket: "31–60 días", amountUsd: 3860, count: 4, tone: "warn" },
    { bucket: "61–90 días", amountUsd: 2170, count: 3, tone: "warn" },
    { bucket: "90+ días", amountUsd: 7998, count: 14, tone: "bad" },
  ],
  cashflow: [
    { label: "esta sem.", amountUsd: 4180 },
    { label: "sem. +1", amountUsd: 2350 },
    { label: "sem. +2", amountUsd: 1440 },
    { label: "sem. +3", amountUsd: 980 },
    { label: "jul.", amountUsd: 9660 },
    { label: "ago.", amountUsd: 3120 },
  ],
  breakdown: [
    { cliente: "Viapol", pedido: "A-039197", montoUsd: 2450, vence: "07/04/2026", estado: "Vencido", dias: 91 },
    { cliente: "Alfredo Nario", pedido: "3102022", montoUsd: 3654, vence: "12/06/2026", estado: "Vencido", dias: 22 },
    { cliente: "Consignaciones", pedido: "—", montoUsd: 500, vence: "05/07/2026", estado: "Esta semana", dias: -1 },
    { cliente: "MONTFRIO", pedido: "Crédito U$S 26", montoUsd: 2918, vence: "14/07/2026", estado: "Próxima semana", dias: -10 },
    { cliente: "Bromyros SA", pedido: "1192551329", montoUsd: 1860, vence: "18/07/2026", estado: "Este mes", dias: -14 },
    { cliente: "DAC Elmar", pedido: "PED-2211", montoUsd: 2995, vence: "29/07/2026", estado: "Este mes", dias: -25 },
  ],
  calendario: [
    { concepto: "UTE", importe: "$ 3.872", vence: "08/07" },
    { concepto: "OSE", importe: "$ 4.274", vence: "10/07" },
    { concepto: "ANTEL Oficina", importe: "$ 325", vence: "12/07" },
    { concepto: "Convenio BPS", importe: "U$S 210", vence: "15/07" },
  ],
  metas: { mes: "Julio", objetivoUsd: 42000, realUsd: 16850 },
};

// Hub sections — every real route gets a card (incl. today's 14 orphans).
export const HUB_SECTIONS = [
  {
    title: "Operación",
    items: [
      { title: "Calculadora BMC", desc: "Cotizaciones, BOM, PDF y presupuestos.", to: "/", color: "#0071e3" },
      { title: "Canales · Inbox unificado", desc: "ML + WA + IG/FB en una cola. Copiar AF, aprobar y enviar.", to: "/hub/canales", color: "#5e5ce6" },
      { title: "WhatsApp · Operativo", desc: "Cockpit WA: SLA, sugerencias, follow-ups, 🚀 canónico.", to: "/hub/wa", color: "#25d366" },
      { title: "MercadoLibre · Operativo", desc: "Cola CRM, respuesta sugerida, aprobar y publicar.", to: "/hub/ml", color: "#e6a700" },
      { title: "MercadoLibre · Manager", desc: "Publicaciones, precios, stock, preguntas y pedidos.", to: "/hub/ml-manager", color: "#e6a700" },
      { title: "LogistikBMC", desc: "Cargas, paradas, remitos y coordinación.", to: "/logistica", color: "#0071e3" },
      { title: "Conductor", desc: "App del transportista: viajes, eventos, evidencia.", to: "/conductor", color: "#0071e3" },
      { title: "Clientes 360", desc: "Vista unificada de clientes y follow-ups.", to: "/hub/clientes", color: "#0071e3" },
      { title: "Planos", desc: "Croquis → plano profesional (DXF/SVG) + presupuesto.", to: "/hub/planos", color: "#0071e3" },
      { title: "Cotizaciones · Admin", desc: "Pendientes, respuestas IA en lote, cierre a Enviados.", to: "/hub/admin", color: "#1a3a5c" },
    ],
  },
  {
    title: "IA & Automatización",
    items: [
      { title: "IA · Control Plane", desc: "Estado de asistentes, claves & APIs, consumo y budget.", to: "/hub/ia", color: "#7c3aed", badge: "NUEVO" },
      { title: "Panelin · Asistente", desc: "Cotizá conversando. Te guía paso a paso según tu obra.", to: "/?chat=1", color: "#1a3a5c" },
      { title: "Panelin · Admin IA", desc: "KB, system prompt, logs, stats y scoring.", to: "/hub/agent-admin", color: "#1a3a5c" },
      { title: "Panelin · Live (voz)", desc: "Sesión de voz en tiempo real con contexto de lead.", to: "/panelin/live", color: "#1a3a5c" },
    ],
  },
  {
    title: "Finanzas & Analytics",
    items: [
      { title: "Finanzas", desc: "KPIs, aging de cobros/pagos, flujo de caja y vencimientos.", to: "/hub/finanzas", color: "#0b8043", badge: "NUEVO" },
      { title: "Marketing · Intel", desc: "KPIs de mercado, alertas, mystery shopping y brief IA.", to: "/hub/marketing", color: "#0b8043" },
      { title: "Analytics · Identity", desc: "Uso por usuario/módulo, sesiones y actividad.", to: "/hub/admin/analytics", color: "#0b8043", admin: true },
      { title: "TrakTime", desc: "Horas, jornadas y facturación de tiempo.", to: "/hub/traktime", color: "#0b8043" },
    ],
  },
  {
    title: "Personal & Equipo",
    items: [
      { title: "Mi Espacio", desc: "Tus cotizaciones, bandeja, mensajes y preferencias.", to: "/mi-espacio", color: "#0071e3" },
      { title: "Tareas · Google Tasks", desc: "Espejo bidireccional de tus listas (sync 60 s).", to: "/hub/tareas", color: "#0b8043" },
      { title: "Proyecto · Status", desc: "Estado y progreso del programa BMC.", to: "/hub/proyecto", color: "#0071e3" },
      { title: "Usuarios & Permisos", desc: "Roles, módulos y grants de identidad.", to: "/hub/admin/users", color: "#1a3a5c", admin: true },
    ],
  },
  {
    title: "Herramientas internas",
    items: [
      { title: "Inspector de Cálculos", desc: "Fórmulas BMC en vivo + comparativa Kingspan.", to: "/inspector", color: "#1a3a5c", internal: true },
      { title: "Bugs reportados", desc: "Reportes con logs de sesión y capturas.", to: "/hub/bugs", color: "#c0392b", internal: true },
      { title: "Especificaciones", desc: "Sandbox de especificaciones con pipeline PDF.", to: "/especificaciones", color: "#1a3a5c", internal: true },
      { title: "Fichas técnicas", desc: "Preview navegable de fichas de producto.", to: "/fichas", color: "#1a3a5c", internal: true },
      { title: "Presentación licitación", desc: "PDF de benchmark para licitaciones.", to: "/presentacion-licitacion", color: "#1a3a5c", internal: true },
      { title: "Design mockups", desc: "Galería de estudios visuales.", to: "/preview/design-mockups", color: "#1a3a5c", internal: true },
    ],
  },
];
