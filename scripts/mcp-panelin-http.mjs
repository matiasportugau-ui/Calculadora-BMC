#!/usr/bin/env node
/**
 * MCP server (stdio) — thin proxy to the running Panelin HTTP API.
 * Requires: npm run start:api (or set BMC_API_BASE to Cloud Run / production).
 *
 * Cursor: add to MCP config — command: node, args: ["scripts/mcp-panelin-http.mjs"], env: { BMC_API_BASE: "http://localhost:3001" }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.BMC_API_BASE || "http://localhost:3001").replace(/\/$/, "");

const mcpServer = new McpServer({
  name: "panelin-bmc-http",
  version: "1.0.0",
});

function textResult(obj) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: "text", text }] };
}

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
      "Petición HTTP al API Panelin (mismo origen que BMC_API_BASE). Usar paths /calc/* o /api/*.",
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
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
