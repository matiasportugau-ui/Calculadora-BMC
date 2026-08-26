/**
 * Paneli MCP server factory — registers AGENT_TOOLS for ElevenLabs voice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AGENT_TOOLS, executeTool } from "../lib/agentTools.js";
import { resolveDenyList } from "./denyList.js";
import {
  anthropicSchemaToZodShape,
  normalizeToolArgs,
  schemaSummary,
} from "./schemaAdapter.js";
import { shapeToolResult } from "./voiceShape.js";
import { getCalcState, setCalcState } from "./conversationState.js";

/**
 * @param {{ sessionKey?: string, logger?: { info?: Function, error?: Function } }} [opts]
 */
export function createPaneliMcpServer(opts = {}) {
  const sessionKey = opts.sessionKey || "default";
  const logger = opts.logger || console;
  const { denied, allowWrites } = resolveDenyList();

  const server = new McpServer({
    name: "paneli-bmc-calc",
    version: "1.0.0",
  });

  let registered = 0;
  const skipped = [];

  for (const tool of AGENT_TOOLS) {
    if (denied.has(tool.name)) {
      skipped.push(tool.name);
      continue;
    }

    const inputSchema = anthropicSchemaToZodShape(tool.input_schema);
    const desc = [
      tool.description,
      schemaSummary(tool.input_schema),
      "Fuente: motor Calculadora BMC (executeTool). Precios reales — no inventar números.",
    ].join("\n\n");

    try {
      server.registerTool(
        tool.name,
        {
          description: desc,
          inputSchema,
        },
        async (args) => {
          const input = normalizeToolArgs(args || {});
          const calcState = getCalcState(sessionKey);
          try {
            const raw = await executeTool(tool.name, input, calcState, {
              logger,
              source: "paneli_mcp",
            });
            // Persist state mutations from aplicar_estado_calc when present
            if (tool.name === "aplicar_estado_calc") {
              try {
                const parsed = JSON.parse(raw);
                if (parsed?.ok && parsed?.state) {
                  setCalcState(sessionKey, parsed.state, { replace: true });
                } else if (parsed?.ok) {
                  setCalcState(sessionKey, {
                    scenario: input.scenario ?? calcState.scenario,
                    listaPrecios: input.listaPrecios ?? calcState.listaPrecios,
                    techo: input.techo ?? calcState.techo,
                    pared: input.pared ?? calcState.pared,
                    camara: input.camara ?? calcState.camara,
                    flete: input.flete ?? calcState.flete,
                  });
                }
              } catch {
                /* ignore */
              }
            }
            const text = shapeToolResult(tool.name, raw);
            return { content: [{ type: "text", text }] };
          } catch (err) {
            const msg = err?.message || String(err);
            logger.error?.({ err, tool: tool.name }, "paneli mcp tool failed");
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ ok: false, error: msg, tool: tool.name }),
                },
              ],
            };
          }
        },
      );
      registered++;
    } catch (err) {
      logger.error?.(`[paneli-mcp] register failed ${tool.name}: ${err?.message}`);
      skipped.push(tool.name);
    }
  }

  server.registerTool(
    "paneli_mcp_meta",
    {
      description:
        "Metadatos del MCP Paneli: cantidad de tools, writes habilitados, tools denegadas.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            name: "paneli-bmc-calc",
            registered,
            total_agent_tools: AGENT_TOOLS.length,
            allow_writes: allowWrites,
            denied: [...denied].sort(),
            transport: "streamable-http",
          }),
        },
      ],
    }),
  );
  registered++;

  return {
    server,
    meta: {
      registered,
      skipped,
      allowWrites,
      denied: [...denied],
      total: AGENT_TOOLS.length,
    },
  };
}

export function listPaneliMcpToolNames() {
  const { denied } = resolveDenyList();
  return AGENT_TOOLS.map((t) => t.name).filter((n) => !denied.has(n));
}
