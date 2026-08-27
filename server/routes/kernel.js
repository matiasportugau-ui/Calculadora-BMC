/**
 * Kernel factory + interior bus.
 *
 *   POST /api/kernel/agents          provisionAgent
 *   GET  /api/kernel/agents          list
 *   GET  /api/kernel/agents/:id      playbook + meta
 *   POST /api/kernel/agents/:id/select  set active
 *   POST /api/kernel/tool            Kernel function dispatch
 *   POST /api/kernel/events          host bus (turns, app events, snapshot)
 *   POST /api/kernel/reload/:id      playbook for session.update
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { config } from "../config.js";
import {
  provisionAgent,
  listSupervisedAgents,
  seedPanelin,
  refreshPanelinPlaybook,
} from "../lib/kernel/provision.js";
import {
  loadStore,
  saveStore,
  getAgent,
  setActiveAgent,
  markReloaded,
  ingestConversationTurn,
  ingestAppEvent,
  resetLiveSession,
  readConversationLog,
} from "../lib/kernel/store.js";
import { executeKernelTool, hostSetSnapshot, isKernelTool } from "../lib/kernel/tools.js";
import { buildKernelSessionBootstrap } from "../lib/kernel/kernelSessionConfig.js";
import { buildAgentReloadPayload } from "../lib/kernel/agentInstructions.js";

const router = Router();

function clientKey(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { ok: false, error: "Demasiadas llamadas Kernel. Esperá un momento." },
});

const auth = requireServiceOrUser({ module: "calc", minLevel: "write" });

router.post("/kernel/reset", auth, writeLimiter, (_req, res) => {
  const store = loadStore();
  seedPanelin(store);
  refreshPanelinPlaybook(store);
  resetLiveSession(store);
  return res.json({
    ok: true,
    activeAgentId: "panelin",
    mode: "observe",
    ...listSupervisedAgents(),
  });
});

router.get("/kernel/conversation", auth, (req, res) => {
  const store = loadStore();
  seedPanelin(store);
  const limit = Math.min(80, Math.max(1, Number(req.query.limit) || 40));
  const turns = readConversationLog(store, { limit });
  return res.json({ ok: true, turns });
});

router.get("/kernel/agents", auth, (_req, res) => {
  seedPanelin();
  return res.json({ ok: true, ...listSupervisedAgents() });
});

router.post("/kernel/agents", auth, writeLimiter, (req, res) => {
  try {
    const agent = provisionAgent(req.body || {});
    return res.status(201).json({
      ok: true,
      ...agent,
      kernelSession: { agent_id: agent.agent_id, voice: "rigel" },
      agentSession: {
        voice: "eve",
        instructions: agent.playbook,
        turn_detection: { type: "server_vad" },
      },
    });
  } catch (err) {
    const status = err?.status || 500;
    return res.status(status).json({ ok: false, error: err.message });
  }
});

router.get("/kernel/agents/:id", auth, (req, res) => {
  const store = loadStore();
  seedPanelin(store);
  const agent = getAgent(store, req.params.id);
  if (!agent) return res.status(404).json({ ok: false, error: "agent not found" });
  return res.json({ ok: true, agent });
});

router.post("/kernel/agents/:id/select", auth, writeLimiter, (req, res) => {
  const store = loadStore();
  seedPanelin(store);
  const agent = setActiveAgent(store, req.params.id);
  if (!agent) return res.status(404).json({ ok: false, error: "agent not found" });
  saveStore(store);
  return res.json({ ok: true, activeAgentId: agent.agent_id, agent });
});

router.post("/kernel/reload/:id", auth, (req, res) => {
  const store = loadStore();
  seedPanelin(store);
  const agent = getAgent(store, req.params.id);
  if (!agent) return res.status(404).json({ ok: false, error: "agent not found" });
  markReloaded(store, agent.agent_id);
  saveStore(store);
  const calcState = req.body?.calcState && typeof req.body.calcState === "object"
    ? req.body.calcState
    : {};
  return res.json({
    ok: true,
    ...buildAgentReloadPayload(agent, calcState),
  });
});

router.post("/kernel/tool", auth, writeLimiter, (req, res) => {
  const { name, arguments: rawArgs, args } = req.body || {};
  const toolName = String(name || "").trim();
  if (!isKernelTool(toolName)) {
    return res.status(400).json({ ok: false, error: `Unknown kernel tool: ${toolName}` });
  }
  const payload = rawArgs != null ? rawArgs : args || {};
  try {
    const result = executeKernelTool(toolName, payload);
    return res.json({ ok: true, kind: "tool", name: toolName, result });
  } catch (err) {
    const status = err?.status || 500;
    req.log?.warn?.({ err, toolName }, "kernel tool failed");
    return res.status(status).json({
      ok: false,
      kind: "tool",
      name: toolName,
      result: { ok: false, error: err.message },
    });
  }
});

/**
 * Host bus — browser writes turns/events/snapshot without waiting for Kernel to call ingest_*.
 * Body: { kind: "turn"|"event"|"snapshot", ...fields }
 */
router.post("/kernel/events", auth, writeLimiter, (req, res) => {
  const body = req.body || {};
  const kind = String(body.kind || body.type || "").trim();
  const store = loadStore();
  seedPanelin(store);
  try {
    if (kind === "turn" || kind === "ingest_conversation_turn") {
      const result = ingestConversationTurn(store, body);
      saveStore(store);
      return res.json({ ok: true, ...result });
    }
    if (kind === "event" || kind === "ingest_app_event") {
      const result = ingestAppEvent(store, body);
      saveStore(store);
      return res.json({ ok: true, ...result });
    }
    if (kind === "snapshot") {
      const snapshot = hostSetSnapshot(body.snapshot || body);
      return res.json({ ok: true, snapshot });
    }
    return res.status(400).json({ ok: false, error: "kind must be turn|event|snapshot" });
  } catch (err) {
    const status = err?.status || 500;
    return res.status(status).json({ ok: false, error: err.message });
  }
});

/** Dev helper: Kernel bootstrap shape without minting a Realtime token. */
router.get("/kernel/session-bootstrap", auth, (req, res) => {
  const store = loadStore();
  seedPanelin(store);
  const agentId = String(req.query.agent_id || store.activeAgentId || "panelin");
  const boot = buildKernelSessionBootstrap(agentId, { mode: store.mode });
  return res.json({
    ok: true,
    agent_id: agentId,
    mode: store.mode,
    appEnv: config.appEnv,
    session_bootstrap: boot,
    tool_names: (boot.tools || []).map((t) => t.name || t.type),
  });
});

export default router;
