/**
 * Single manifest for AI agents: calculator (/calc/*) + dashboard (/api/*) + UI entry points.
 * Served at GET /capabilities; static snapshot: docs/api/AGENT-CAPABILITIES.json
 * Regenerate snapshot: npm run capabilities:snapshot
 */
import { GPT_ACTIONS } from "./gptActions.js";

/** BMC Finanzas dashboard routes (mount /api). Keep in sync with server/routes/bmcDashboard.js */
const DASHBOARD_ROUTES = [
  { method: "GET", path: "/api/cotizaciones", summary: "Listado cotizaciones (Sheets)" },
  { method: "POST", path: "/api/cotizaciones", summary: "Crear/actualizar cotización (según implementación)" },
  { method: "GET", path: "/api/proximas-entregas", summary: "Próximas entregas" },
  { method: "GET", path: "/api/coordinacion-logistica", summary: "Coordinación logística" },
  { method: "GET", path: "/api/audit", summary: "Audit de datos" },
  { method: "GET", path: "/api/pagos-pendientes", summary: "Pagos pendientes" },
  { method: "GET", path: "/api/metas-ventas", summary: "Metas de ventas" },
  { method: "GET", path: "/api/calendario-vencimientos", summary: "Calendario vencimientos" },
  { method: "GET", path: "/api/ventas", summary: "Ventas" },
  { method: "GET", path: "/api/ventas/tabs", summary: "Tabs ventas" },
  { method: "GET", path: "/api/stock-ecommerce", summary: "Stock e-commerce" },
  { method: "GET", path: "/api/stock-kpi", summary: "KPI stock" },
  { method: "GET", path: "/api/kpi-financiero", summary: "KPI financiero" },
  { method: "GET", path: "/api/stock/history", summary: "Historial stock" },
  { method: "GET", path: "/api/kpi-report", summary: "Reporte KPI operativo" },
  { method: "POST", path: "/api/pagos", summary: "Pagos" },
  { method: "POST", path: "/api/ventas", summary: "POST ventas" },
  { method: "POST", path: "/api/marcar-entregado", summary: "Marcar entregado" },
  { method: "GET", path: "/api/actualizar-precios-calculadora", summary: "Sincronizar precios hacia calculadora" },
  { method: "POST", path: "/api/matriz/push-pricing-overrides", summary: "Overrides → MATRIZ BROMYROS (F/L/T tal cual s/IVA; auth token)" },
  { method: "GET", path: "/api/email/panelsim-summary", summary: "PANELSIM: STATUS.json + reporte MD del repo IMAP (Bearer API_AUTH_TOKEN)" },
  { method: "POST", path: "/api/email/draft-outbound", summary: "Borrador email proveedor/cliente (no envía; misma auth que cockpit)" },
];

/**
 * @param {{ publicBaseUrl: string }} config
 */
export function buildAgentCapabilitiesManifest(config) {
  const base = String(config.publicBaseUrl || "http://localhost:3001").replace(/\/$/, "");

  const calculator = {
    prefix: "/calc",
    canonical: {
      gpt_entry_point: `${base}/calc/gpt-entry-point`,
      openapi_yaml: `${base}/calc/openapi`,
      informe: `${base}/calc/informe`,
      catalogo: `${base}/calc/catalogo`,
      escenarios: `${base}/calc/escenarios`,
    },
    actions: GPT_ACTIONS.map((a) => ({
      operationId: a.operationId,
      method: a.method,
      path: a.path,
      summary: a.summary,
      whenToUse: a.whenToUse,
      url: `${base}${a.path}`,
    })),
  };

  const dashboard = {
    prefix: "/api",
    routes: DASHBOARD_ROUTES.map((r) => ({
      ...r,
      url: `${base}${r.path}`,
    })),
  };

  const ui = {
    finanzas_spa: `${base}/finanzas`,
    calculadora_spa: `${base}/calculadora`,
    notes: "SPA routes require browser or static deploy; see docs/AGENT-UI-VS-API.md",
  };

  const discovery = {
    capabilities_url: `${base}/capabilities`,
    health_url: `${base}/health`,
    docs: {
      agent_ui_vs_api: "docs/AGENT-UI-VS-API.md",
      static_capabilities_json: "docs/api/AGENT-CAPABILITIES.json",
      openapi_calc_file: "docs/openapi-calc.yaml",
    },
  };

  return {
    ok: true,
    schema_version: "1",
    description:
      "Single index for AI agents: Calculator GPT Actions + BMC Dashboard API + UI entry points.",
    public_base_url: base,
    calculator,
    dashboard,
    ui,
    discovery,
  };
}
