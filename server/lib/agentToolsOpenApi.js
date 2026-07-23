/**
 * B-04 — Build OpenAPI 3.1 document from AGENT_TOOLS (Anthropic tool schema).
 * IMP-14 — capability tiers on catalog export.
 */

/** @type {Record<string, "open"|"quote"|"crm"|"admin"|"email"|"traktime">} */
const TOOL_TIER_OVERRIDES = {
  calcular_cotizacion: "quote",
  presupuesto_libre: "quote",
  comparar_listas: "quote",
  comparar_escenarios: "quote",
  generar_pdf: "quote",
  guardar_en_crm: "crm",
  enviar_whatsapp_link: "crm",
  historial_cliente: "crm",
  buscar_cliente_crm: "crm",
  wa_lead_to_admin: "admin",
  wolfboard_pendientes: "admin",
  wolfboard_export: "admin",
  wolfboard_sync: "admin",
  wolfboard_actualizar_fila: "admin",
  wolfboard_marcar_enviado: "admin",
  wolfboard_quote_batch: "admin",
  email_listar_hilos: "email",
  email_leer_hilo: "email",
  email_clasificar_mensaje: "email",
  email_borrador_saliente: "email",
  email_enviar: "email",
  email_panelsim_resumen: "email",
};

/**
 * Resolve MCP/GPT exposure tier for a tool name.
 * @param {string} name
 * @returns {"open"|"quote"|"crm"|"admin"|"email"|"traktime"}
 */
export function resolveToolTier(name) {
  if (TOOL_TIER_OVERRIDES[name]) return TOOL_TIER_OVERRIDES[name];
  if (name.startsWith("traktime_")) return "traktime";
  if (name.startsWith("email_")) return "email";
  if (name.startsWith("wolfboard_")) return "admin";
  return "open";
}

/**
 * @param {Array<{ name: string, description?: string, input_schema?: object }>} tools
 * @param {{ baseUrl?: string, toolsRequiringAuth?: Set<string>|string[] }} [opts]
 * @returns {object} OpenAPI 3.1 document (plain JSON-serializable)
 */
export function buildAgentToolsOpenApi(tools, opts = {}) {
  const list = Array.isArray(tools) ? tools : [];
  const authSet = opts.toolsRequiringAuth
    ? opts.toolsRequiringAuth instanceof Set
      ? opts.toolsRequiringAuth
      : new Set(opts.toolsRequiringAuth)
    : new Set();

  const toolNames = list.map((t) => t.name).filter(Boolean);
  const schemas = {};
  const toolCatalog = [];

  for (const t of list) {
    if (!t?.name) continue;
    const schemaName = `AgentToolInput_${sanitizeSchemaName(t.name)}`;
    schemas[schemaName] = normalizeJsonSchema(t.input_schema || { type: "object", properties: {} });
    toolCatalog.push({
      name: t.name,
      description: t.description || "",
      requires_auth: authSet.has(t.name),
      tier: resolveToolTier(t.name),
      input_schema_ref: `#/components/schemas/${schemaName}`,
    });
  }

  const baseUrl = typeof opts.baseUrl === "string" ? opts.baseUrl.replace(/\/+$/, "") : undefined;

  return {
    openapi: "3.1.0",
    info: {
      title: "Panelin Agent Tools API",
      version: "1.0.0",
      description:
        "OpenAPI export of in-process AGENT_TOOLS for Panelin chat agent. " +
        "Execute tools via POST /api/agent/exec-tool. List schemas via GET /api/agent/tools-manifest. " +
        "Write/PII tools require Authorization: Bearer (API_AUTH_TOKEN or operator JWT).",
    },
    ...(baseUrl ? { servers: [{ url: baseUrl, description: "API base" }] } : {}),
    tags: [
      { name: "discovery", description: "Tool catalog and OpenAPI" },
      { name: "execution", description: "Run a single tool" },
    ],
    paths: {
      "/api/agent/tools/openapi": {
        get: {
          tags: ["discovery"],
          operationId: "getAgentToolsOpenApi",
          summary: "OpenAPI 3.1 document for AGENT_TOOLS",
          parameters: [
            {
              name: "format",
              in: "query",
              schema: { type: "string", enum: ["json", "yaml"], default: "json" },
              description: "Response format (yaml requires Accept or format=yaml)",
            },
          ],
          responses: {
            "200": {
              description: "OpenAPI document",
              content: {
                "application/json": { schema: { type: "object" } },
                "application/yaml": { schema: { type: "string" } },
              },
            },
          },
        },
      },
      "/api/agent/tools-manifest": {
        get: {
          tags: ["discovery"],
          operationId: "getAgentToolsManifest",
          summary: "List AGENT_TOOLS (Anthropic input_schema format)",
          responses: {
            "200": {
              description: "Tool list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      count: { type: "integer" },
                      tools: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/agent/exec-tool": {
        post: {
          tags: ["execution"],
          operationId: "execAgentTool",
          summary: "Execute one AGENT_TOOLS entry by name",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "input"],
                  properties: {
                    name: {
                      type: "string",
                      enum: toolNames.length ? toolNames : undefined,
                      description: "Tool name from AGENT_TOOLS",
                    },
                    input: {
                      type: "object",
                      description: "Tool input matching the tool's input_schema",
                      additionalProperties: true,
                    },
                    calcState: {
                      type: "object",
                      description: "Optional calculator state snapshot",
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tool result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      name: { type: "string" },
                      result: {},
                    },
                  },
                },
              },
            },
            "401": { description: "Auth required for this tool" },
            "404": { description: "Unknown tool name" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT or API_AUTH_TOKEN",
        },
      },
      schemas: {
        ...schemas,
        AgentToolCatalogEntry: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            requires_auth: { type: "boolean" },
            tier: {
              type: "string",
              enum: ["open", "quote", "crm", "admin", "email", "traktime"],
            },
            input_schema_ref: { type: "string" },
          },
        },
      },
      "x-agent-tools": toolCatalog,
    },
  };
}

/**
 * Minimal JSON → YAML for OpenAPI docs (no external dep).
 * Handles objects, arrays, strings, numbers, booleans, null.
 * @param {unknown} value
 * @param {number} [indent]
 * @returns {string}
 */
export function toYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value === "" || /[:#\n\r\t{}[\],&*?|<>=!%@`'"]/.test(value) || value.trim() !== value) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const nested = toYaml(item, indent + 1);
          const lines = nested.split("\n");
          return `${pad}- ${lines[0]}\n${lines
            .slice(1)
            .map((l) => (l.startsWith("  ".repeat(indent + 1)) ? l : `${"  ".repeat(indent + 1)}${l}`))
            .join("\n")}`.replace(/\n+$/, "");
        }
        return `${pad}- ${toYaml(item, 0)}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return keys
      .map((k) => {
        const v = value[k];
        if (v !== null && typeof v === "object") {
          const nested = toYaml(v, indent + 1);
          if (nested === "{}" || nested === "[]") return `${pad}${k}: ${nested}`;
          return `${pad}${k}:\n${nested}`;
        }
        return `${pad}${k}: ${toYaml(v, 0)}`;
      })
      .join("\n");
  }
  return JSON.stringify(String(value));
}

function sanitizeSchemaName(name) {
  return String(name).replace(/[^A-Za-z0-9_]/g, "_");
}

/** Shallow-normalize Anthropic/JSON schema for OpenAPI components. */
function normalizeJsonSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return { type: "object", additionalProperties: true };
  }
  // Clone via JSON to drop non-serializable bits
  try {
    return JSON.parse(JSON.stringify(schema));
  } catch {
    return { type: "object", additionalProperties: true };
  }
}
