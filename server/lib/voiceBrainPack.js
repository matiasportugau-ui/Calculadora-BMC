/**
 * Voice Brain Pack — instructions + tools for in-app Grok Realtime.
 *
 * Combines:
 *   A. Console Panelin BMC voice instructions (speech layer)
 *   B. Shared IAlfred↔Panelin lessons (brainKB) when VITE_FEATURE_BRAIN is on
 *   C. Same AGENT_TOOLS allowlist as the Paneli MCP connector (executed server-side)
 *   D. Client function tools that fill the calculator form
 *
 * MCP authorization is NEVER placed on the bootstrap sent to the browser.
 * xAI console still uses remote MCP; the SPA relays function calls to
 * POST /api/agent/voice/action which runs executeTool.
 */
import { config } from "../config.js";
import { brainBlock } from "./brainKB.js";
import { AGENT_TOOLS } from "./agentTools.js";
import { PANELIN_BMC_VOICE_INSTRUCTIONS } from "./voice/panelinBmcInstructions.js";
import { buildVoiceDynamicContext } from "./chatPrompts.js";

/** Calc/read tools that match the trained console connector allowlist. */
export const VOICE_BRAIN_TOOL_ALLOWLIST = Object.freeze([
  "calcular_cotizacion",
  "obtener_precio_panel",
  "listar_opciones_panel",
  "get_calc_state",
  "obtener_escenarios",
  "obtener_catalogo",
  "comparar_listas",
  "comparar_escenarios",
  "presupuesto_libre",
  "buscar_producto",
  "listar_cotizaciones_recientes",
  "obtener_cotizacion_por_id",
  "historial_cliente",
  "sheets_get_pending_admin",
  "sheets_list_tabs",
  "sheets_read_range",
  "sheets_find",
  "aplicar_estado_calc",
  "generar_pdf",
  "admin_cargar_pdfs_fila",
  "archivar_pdfs_drive",
]);

export const VOICE_BRAIN_TOOL_SET = new Set(VOICE_BRAIN_TOOL_ALLOWLIST);

/** Writes that voice HITL already confirmed by speaking — stamp user_confirmed. */
export const VOICE_WRITE_AUTOCONFIRM = Object.freeze([
  "generar_pdf",
  "admin_cargar_pdfs_fila",
  "archivar_pdfs_drive",
]);

/** UI actions the existing /panelin/live path already understands. */
export const VOICE_FORM_FUNCTION_TOOLS = Object.freeze([
  {
    type: "function",
    name: "setScenario",
    description: "Establece el escenario de la calculadora (solo_techo, solo_fachada, techo_fachada, camara_frig)",
    parameters: { type: "object", properties: { scenario: { type: "string" } }, required: ["scenario"] },
  },
  {
    type: "function",
    name: "setLP",
    description: "Establece la lista de precios (web o venta)",
    parameters: { type: "object", properties: { listaPrecios: { type: "string" } }, required: ["listaPrecios"] },
  },
  {
    type: "function",
    name: "setTecho",
    description: "Configura los parámetros del techo en el formulario en pantalla",
    parameters: {
      type: "object",
      properties: {
        familia: { type: "string" },
        espesor: { type: "string" },
        color: { type: "string" },
        tipoAguas: { type: "string" },
        pendiente: { type: "number" },
        tipoEst: { type: "string" },
        zonas: { type: "array", items: { type: "object" } },
      },
    },
  },
  {
    type: "function",
    name: "setPared",
    description: "Configura los parámetros de la pared/fachada en el formulario",
    parameters: {
      type: "object",
      properties: {
        familia: { type: "string" },
        espesor: { type: "string" },
        alto: { type: "number" },
        perimetro: { type: "number" },
      },
    },
  },
  {
    type: "function",
    name: "setCamara",
    description: "Configura las dimensiones de la cámara frigorífica",
    parameters: {
      type: "object",
      properties: {
        largo_int: { type: "number" },
        ancho_int: { type: "number" },
        alto_int: { type: "number" },
      },
      required: ["largo_int", "ancho_int", "alto_int"],
    },
  },
  {
    type: "function",
    name: "setFlete",
    description: "Establece el costo de flete en USD",
    parameters: { type: "object", properties: { flete: { type: "number" } }, required: ["flete"] },
  },
  {
    type: "function",
    name: "setProyecto",
    description: "Establece datos del proyecto (nombre, RUT, etc.)",
    parameters: { type: "object", properties: { nombre: { type: "string" }, rut: { type: "string" } } },
  },
]);

export const VOICE_WEB_SEARCH_TOOL = Object.freeze({
  type: "web_search",
  allowed_domains: ["bmcuruguay.com.uy"],
});

export const VOICE_KEYTERMS = Object.freeze([
  "Panelin",
  "IsoDec",
  "IsoRoof",
  "IsoPanel",
  "IsoWall",
  "IsoFrig",
  "EPS",
  "PIR",
  "BMC Uruguay",
  "METALOG",
]);

export const VOICE_PRONUNCIATION_REPLACE = Object.freeze({
  IsoDec: "Iso-dec",
  IsoRoof: "Iso-roof",
  IsoPanel: "Iso-panel",
  IsoWall: "Iso-wall",
  IsoFrig: "Iso-frig",
  PIR: "P-I-R",
  EPS: "E-P-S",
});

/**
 * Anthropic AGENT_TOOLS row → OpenAI/xAI Realtime function tool.
 * @param {{ name: string, description?: string, input_schema?: object }} tool
 */
export function agentToolToRealtimeFunction(tool) {
  const schema = tool?.input_schema && typeof tool.input_schema === "object"
    ? tool.input_schema
    : { type: "object", properties: {} };
  return {
    type: "function",
    name: tool.name,
    description: tool.description || tool.name,
    parameters: schema,
  };
}

export function buildVoiceAgentFunctionTools(allowlist = VOICE_BRAIN_TOOL_ALLOWLIST) {
  const want = new Set(allowlist);
  return AGENT_TOOLS
    .filter((t) => want.has(t.name))
    .map(agentToolToRealtimeFunction);
}

/**
 * Strip MCP secrets if a future caller adds type:mcp to the pack.
 * @param {object} boot
 */
export function sanitizeBootstrapForClient(boot = {}) {
  const tools = Array.isArray(boot.tools)
    ? boot.tools.map((t) => {
      if (!t || typeof t !== "object" || t.type !== "mcp") return t;
      const rest = { ...t };
      delete rest.authorization;
      delete rest.headers;
      return rest;
    })
    : boot.tools;
  const json = JSON.stringify({ ...boot, tools });
  if (
    /"authorization"\s*:/i.test(json) ||
    /PANELI_MCP_SECRET/i.test(json) ||
    /Bearer\s+(sk-|xai-|ek_|dp\.|ya29\.)/i.test(json)
  ) {
    throw new Error("voice brain pack leaked a secret into session_bootstrap");
  }
  return { ...boot, tools };
}

/**
 * @param {object} calcState
 * @param {{ devMode?: boolean, leadContext?: object|null }} [options]
 * @returns {{
 *   instructions: string,
 *   tools: object[],
 *   tool_choice: string,
 *   voice: string,
 *   language_hint: string,
 *   keyterms: string[],
 *   replace: Record<string,string>,
 * }}
 */
export function buildVoiceBrainPack(calcState = {}, options = {}) {
  const { devMode = false, leadContext = null } = options;
  const brainStr = config.brainEnabled ? brainBlock(options.userText || "") : "";
  const liveContext = buildVoiceDynamicContext(calcState, { devMode, leadContext });
  const instructions = [
    PANELIN_BMC_VOICE_INSTRUCTIONS,
    brainStr,
    liveContext,
  ].filter(Boolean).join("\n\n");

  const tools = [
    VOICE_WEB_SEARCH_TOOL,
    ...buildVoiceAgentFunctionTools(),
    ...VOICE_FORM_FUNCTION_TOOLS,
  ];

  return sanitizeBootstrapForClient({
    instructions,
    tools,
    tool_choice: "auto",
    voice: "eve",
    language_hint: "es-ES",
    keyterms: [...VOICE_KEYTERMS],
    replace: { ...VOICE_PRONUNCIATION_REPLACE },
  });
}
