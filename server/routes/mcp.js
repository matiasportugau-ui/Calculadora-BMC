/**
 * Paneli MCP — Streamable HTTP for ElevenLabs Conversational AI.
 * Mount at /mcp (and optionally /api/mcp).
 *
 * Auth: Authorization Bearer PANELI_MCP_SECRET (see server/mcp/auth.js)
 * Transport: Streamable HTTP with JSON responses + in-memory sessions
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { requirePaneliMcpAuth } from "../mcp/auth.js";
import { createPaneliMcpServer, listPaneliMcpToolNames } from "../mcp/paneliMcpServer.js";
import { resolveDenyList } from "../mcp/denyList.js";
import { sessionKeyFromReq } from "../mcp/conversationState.js";

/** @type {Map<string, { transport: StreamableHTTPServerTransport, sessionKey: string }>} */
const sessions = new Map();

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessionTouch = new Map();

function touchSession(id) {
  sessionTouch.set(id, Date.now());
}

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, t] of sessionTouch) {
    if (t < cutoff) {
      const entry = sessions.get(id);
      try {
        entry?.transport?.close?.();
      } catch {
        /* ignore */
      }
      sessions.delete(id);
      sessionTouch.delete(id);
    }
  }
}

setInterval(pruneSessions, 15 * 60 * 1000).unref?.();

function createMcpRouter() {
  const router = Router();

  router.get("/health", (_req, res) => {
    const { allowWrites, denied } = resolveDenyList();
    const names = listPaneliMcpToolNames();
    res.json({
      ok: true,
      name: "paneli-bmc-calc",
      transport: "streamable-http",
      toolCount: names.length,
      allowWrites,
      deniedCount: denied.size,
      activeSessions: sessions.size,
    });
  });

  router.use(requirePaneliMcpAuth);

  // CORS preflight for ElevenLabs / browsers
  router.options("/", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Api-Key,Mcp-Session-Id,X-Conversation-Id",
    );
    res.status(204).end();
  });

  router.post("/", async (req, res) => {
    pruneSessions();
    try {
      const sessionIdHdr = req.headers["mcp-session-id"];
      const existingId = typeof sessionIdHdr === "string" ? sessionIdHdr : undefined;

      if (existingId && sessions.has(existingId)) {
        touchSession(existingId);
        const { transport } = sessions.get(existingId);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (!existingId && isInitializeRequest(req.body)) {
        const convKey = sessionKeyFromReq(req, undefined);
        const { server } = createPaneliMcpServer({
          sessionKey: convKey,
          logger: req.log || console,
        });

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid) => {
            sessions.set(sid, { transport, sessionKey: convKey });
            touchSession(sid);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
            sessionTouch.delete(sid);
          }
        };

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Bad Request: missing or unknown Mcp-Session-Id (send initialize first)",
        },
        id: null,
      });
    } catch (err) {
      req.log?.error?.({ err }, "paneli mcp POST failed");
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Optional SSE stream (spec); JSON-mode clients may not use GET
  router.get("/", async (req, res) => {
    const sessionIdHdr = req.headers["mcp-session-id"];
    const existingId = typeof sessionIdHdr === "string" ? sessionIdHdr : undefined;
    if (existingId && sessions.has(existingId)) {
      touchSession(existingId);
      const { transport } = sessions.get(existingId);
      await transport.handleRequest(req, res);
      return;
    }
    res.status(405).set("Allow", "POST").json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method Not Allowed — use POST Streamable HTTP (JSON mode)",
      },
      id: null,
    });
  });

  router.delete("/", async (req, res) => {
    const sessionIdHdr = req.headers["mcp-session-id"];
    const existingId = typeof sessionIdHdr === "string" ? sessionIdHdr : undefined;
    if (existingId && sessions.has(existingId)) {
      const { transport } = sessions.get(existingId);
      await transport.handleRequest(req, res);
      sessions.delete(existingId);
      sessionTouch.delete(existingId);
      return;
    }
    res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unknown session" },
      id: null,
    });
  });

  return router;
}

export default createMcpRouter;
export { createMcpRouter };
