#!/usr/bin/env node
/**
 * MCP server (stdio) — exposes the Panelin agent's full tool surface to
 * external Claude Code subagents, GPT Builder, and other MCP clients.
 *
 * The tool count is determined at boot by fetching GET /api/agent/tools-manifest
 * from the running API. Auth-gated tools (those whose `requires_auth` flag is
 * true in the manifest) include the Bearer token from BMC_API_TOKEN if set.
 * Unauthenticated tools are called without a token.
 *
 * Auth-gated tools include CRM reads (buscar_cliente_crm, historial_cliente),
 * CRM/WA writes (guardar_en_crm, enviar_whatsapp_link, cancelar_cotizacion,
 * programar_seguimiento), and all Wolfboard admin tools.
 *
 * Usage:
 *   BMC_API_BASE=http://localhost:3001 npm run mcp:panelin
 *
 * For Cloud Run prod:
 *   BMC_API_BASE=https://panelin-calc-XXX-uc.a.run.app \
 *   BMC_API_TOKEN=<API_AUTH_TOKEN> \
 *   npm run mcp:panelin
 *
 * Cursor / Claude Code MCP config example:
 *   {
 *     "mcpServers": {
 *       "panelin": {
 *         "command": "node",
 *         "args": ["scripts/mcp-panelin-http.mjs"],
 *         "env": {
 *           "BMC_API_BASE": "http://localhost:3001",
 *           "BMC_API_TOKEN": "<API_AUTH_TOKEN>"
 *         }
 *       }
 *     }
 *   }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.BMC_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const TOKEN = process.env.BMC_API_TOKEN || "";

const mcpServer = new McpServer({
  name: "panelin-bmc",
  version: "2.0.0",
});

function textResult(obj) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: "text", text }] };
}

function authHeaders(requiresAuth) {
  const h = { "Content-Type": "application/json" };
  if (requiresAuth && TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function fetchManifest() {
  const res = await fetch(`${BASE}/api/agent/tools-manifest`);
  if (!res.ok) throw new Error(`tools-manifest HTTP ${res.status} from ${BASE}`);
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.tools)) throw new Error("invalid tools-manifest response");
  return data.tools;
}

/**
 * Register each AGENT_TOOL as an MCP tool. Input schema is intentionally
 * loose (z.record(z.unknown())) — server-side validates the actual fields,
 * and the Anthropic input_schema is included verbatim in the description so
 * downstream clients can render the full schema.
 */
function registerAgentTool(tool) {
  const requiresAuth = !!tool.requires_auth;
  const authNote = requiresAuth ? "\n\n⚠️ AUTH: requires BMC_API_TOKEN env var." : "";
  const schemaNote = `\n\nInput schema (Anthropic format):\n${JSON.stringify(tool.input_schema, null, 2)}`;

  mcpServer.registerTool(
    tool.name,
    {
      description: `${tool.description}${authNote}${schemaNote}`,
      inputSchema: { input: z.record(z.unknown()).optional().describe("Input object matching the schema in the description") },
    },
    async ({ input }) => {
      try {
        const body = JSON.stringify({ name: tool.name, input: input || {} });
        const res = await fetch(`${BASE}/api/agent/exec-tool`, {
          method: "POST",
          headers: authHeaders(requiresAuth),
          body,
        });
        const data = await res.json().catch(() => ({ error: "non-JSON response", status: res.status }));
        if (!res.ok) {
          return textResult({ httpStatus: res.status, error: data.error || data, tool: tool.name });
        }
        return textResult({ httpStatus: res.status, ...data });
      } catch (err) {
        return textResult({ error: err.message, tool: tool.name });
      }
    }
  );
}

// ─── Generic fallback tools (for ad-hoc API exploration) ────────────────────

mcpServer.registerTool(
  "panelin_capabilities",
  {
    description: "GET /capabilities — índice unificado Calculadora (/calc) + Dashboard (/api) + UI.",
    inputSchema: {},
  },
  async () => {
    const res = await fetch(`${BASE}/capabilities`);
    const data = await res.json().catch(() => ({ error: "invalid JSON", status: res.status }));
    return textResult({ httpStatus: res.status, body: data });
  }
);

mcpServer.registerTool(
  "panelin_gpt_entry_point",
  {
    description: "GET /calc/gpt-entry-point — acciones GPT, openapi_url, flujo recomendado.",
    inputSchema: {},
  },
  async () => {
    const res = await fetch(`${BASE}/calc/gpt-entry-point`);
    const data = await res.json().catch(() => ({ error: "invalid JSON", status: res.status }));
    return textResult({ httpStatus: res.status, body: data });
  }
);

mcpServer.registerTool(
  "panelin_http_request",
  {
    description:
      "Petición HTTP arbitraria al API Panelin (fallback para endpoints sin tool dedicada). Usar paths /calc/* o /api/*.",
    inputSchema: {
      path: z.string().describe("Ruta absoluta, ej. /calc/cotizar o /api/kpi-financiero"),
      method: z.enum(["GET", "POST"]).optional().default("GET"),
      body: z.record(z.unknown()).optional().describe("Cuerpo JSON para POST"),
    },
  },
  async ({ path, method, body }) => {
    const p = path.startsWith("/") ? path : `/${path}`;
    const opts =
      method === "POST"
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? {}),
          }
        : { method: "GET" };
    const res = await fetch(`${BASE}${p}`, opts);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json().catch(() => null);
      return textResult({ httpStatus: res.status, body: data });
    }
    const raw = await res.text();
    return textResult({ httpStatus: res.status, body: raw.slice(0, 20000) });
  }
);

async function main() {
  let registered = 0;
  try {
    const tools = await fetchManifest();
    for (const t of tools) {
      try {
        registerAgentTool(t);
        registered++;
      } catch (err) {
        console.error(`[mcp-panelin] failed to register ${t.name}: ${err.message}`);
      }
    }
    console.error(`[mcp-panelin] registered ${registered}/${tools.length} agent tools from ${BASE}`);
  } catch (err) {
    console.error(`[mcp-panelin] manifest fetch failed (${err.message}) — only generic fallback tools available.`);
    console.error(`[mcp-panelin] Hint: start the API first with 'npm run start:api' or set BMC_API_BASE to a reachable instance.`);
  }

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
