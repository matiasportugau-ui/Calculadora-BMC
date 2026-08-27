/**
 * Living Kernel store — registry, playbooks, conversation/event logs.
 * Atomic JSON file. Path: KERNEL_STORE_PATH or <cwd>/.kernel/store.json
 *
 * Cloud Run disk is ephemeral; v1 is local/dev durable only.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  shouldMergeUtterance,
  pickMergedText,
} from "../../../src/utils/voiceTranscriptCoalesce.js";
import { isNoiseUtterance } from "../../../src/utils/voiceNoiseFilter.js";

const DEFAULT_REL = path.join(".kernel", "store.json");
const LOG_CAP = 500;
const MODES = new Set(["observe", "report", "intervene", "patch"]);

function defaultStorePath() {
  return process.env.KERNEL_STORE_PATH
    ? path.resolve(process.env.KERNEL_STORE_PATH)
    : path.resolve(process.cwd(), DEFAULT_REL);
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Reject prototype-chain keys so store.agents[id] never resolves to Object.prototype. */
const FORBIDDEN_AGENT_IDS = new Set(["__proto__", "constructor", "prototype"]);

export function isSafeAgentId(agentId) {
  const id = String(agentId || "").trim();
  if (!id || FORBIDDEN_AGENT_IDS.has(id)) return false;
  return true;
}

function emptyAgentsMap() {
  return Object.create(null);
}

function copyAgentsMap(raw) {
  const out = emptyAgentsMap();
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isSafeAgentId(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

function emptyStore() {
  return {
    version: 1,
    mode: "observe",
    activeAgentId: "panelin",
    agents: emptyAgentsMap(),
    conversation: [],
    events: [],
    improvements: [],
    proposals: [],
    reports: [],
    snapshot: null,
  };
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function cap(arr, n = LOG_CAP) {
  if (!Array.isArray(arr) || arr.length <= n) return arr || [];
  return arr.slice(arr.length - n);
}

function stripPath(data) {
  const { _path, ...rest } = data || {};
  return rest;
}

export function getStorePath() {
  return defaultStorePath();
}

export function loadStore(storePath = defaultStorePath()) {
  try {
    if (!fs.existsSync(storePath)) {
      const fresh = emptyStore();
      return { ...fresh, _path: storePath };
    }
    const raw = fs.readFileSync(storePath, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { ...emptyStore(), _path: storePath };
    return {
      ...emptyStore(),
      ...data,
      agents: copyAgentsMap(data.agents),
      conversation: Array.isArray(data.conversation) ? data.conversation : [],
      events: Array.isArray(data.events) ? data.events : [],
      improvements: Array.isArray(data.improvements) ? data.improvements : [],
      proposals: Array.isArray(data.proposals) ? data.proposals : [],
      reports: Array.isArray(data.reports) ? data.reports : [],
      _path: storePath,
    };
  } catch {
    return { ...emptyStore(), _path: storePath };
  }
}

export function saveStore(data) {
  const storePath = data._path || defaultStorePath();
  ensureDir(storePath);
  const payload = {
    ...stripPath(data),
    conversation: cap(data.conversation),
    events: cap(data.events),
    improvements: cap(data.improvements),
    proposals: cap(data.proposals),
    reports: cap(data.reports),
  };
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmp, storePath);
  return { ...payload, _path: storePath };
}

export function resetStore(storePath = defaultStorePath()) {
  const next = { ...emptyStore(), _path: storePath };
  return saveStore(next);
}

/** Fresh Live session: keep agents, wipe logs. Default voice = panelin. */
export function resetLiveSession(store = loadStore()) {
  const agents = copyAgentsMap(store.agents);
  store.conversation = [];
  store.events = [];
  store.improvements = [];
  store.proposals = [];
  store.reports = [];
  store.snapshot = null;
  store.mode = "observe";
  store.activeAgentId = agents.panelin ? "panelin" : Object.keys(agents)[0] || "panelin";
  store.agents = agents;
  return saveStore(store);
}

export function slugAgentId(name) {
  const s = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "agent";
}

export function hashTurn({ speaker, role, text, timestamp }) {
  return crypto
    .createHash("sha1")
    .update(
      `${String(speaker || "")}|${String(role || "")}|${String(text || "").trim()}|${String(timestamp || "")}`,
    )
    .digest("hex")
    .slice(0, 16);
}

export function registerAgent(store, agent) {
  const agent_id = String(agent.agent_id || "").trim();
  if (!isSafeAgentId(agent_id)) {
    const err = new Error("invalid agent_id");
    err.status = 400;
    throw err;
  }
  if (!store.agents || typeof store.agents !== "object") {
    store.agents = emptyAgentsMap();
  } else if (Object.getPrototypeOf(store.agents) !== null) {
    store.agents = copyAgentsMap(store.agents);
  }
  const now = new Date().toISOString();
  const prev = Object.prototype.hasOwnProperty.call(store.agents, agent_id)
    ? store.agents[agent_id]
    : null;
  store.agents[agent_id] = {
    agent_id,
    name: agent.name || agent_id,
    role: agent.role || "",
    language: agent.language === "en" ? "en" : "es",
    playbook: agent.playbook || prev?.playbook || "",
    playbook_url: agent.playbook_url || `/api/kernel/agents/${agent_id}`,
    version: prev ? Number(prev.version || 1) : 1,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    reloadRequested: false,
  };
  if (!store.activeAgentId) store.activeAgentId = agent_id;
  return store.agents[agent_id];
}

export function listAgents(store) {
  return Object.values(store.agents || {}).sort((a, b) =>
    String(a.agent_id).localeCompare(String(b.agent_id)),
  );
}

export function getAgent(store, agentId) {
  const id = agentId === "current" || !agentId ? store.activeAgentId : agentId;
  if (!isSafeAgentId(id)) return null;
  if (!store.agents || !Object.prototype.hasOwnProperty.call(store.agents, id)) return null;
  return store.agents[id] || null;
}

export function setActiveAgent(store, agentId) {
  if (!isSafeAgentId(agentId)) return null;
  if (!store.agents || !Object.prototype.hasOwnProperty.call(store.agents, agentId)) return null;
  store.activeAgentId = agentId;
  return store.agents[agentId];
}

export function setMode(store, mode) {
  const m = String(mode || "").trim();
  if (!MODES.has(m)) {
    const err = new Error(`invalid mode: ${mode}`);
    err.status = 400;
    throw err;
  }
  store.mode = m;
  return store.mode;
}

export function ingestConversationTurn(store, turn) {
  const speaker = String(turn.speaker || "unknown");
  const role = String(turn.role || "bystander");
  const text = String(turn.text || "").trim();
  const addressed_to = String(turn.addressed_to || "unknown");
  const timestamp = turn.timestamp || new Date().toISOString();
  if (!text) {
    const err = new Error("text required");
    err.status = 400;
    throw err;
  }
  if (isNoiseUtterance(text)) {
    return { ok: true, ignored: true, reason: "noise" };
  }
  const id = hashTurn({ speaker, role, text, timestamp });
  if (store.conversation.some((t) => t.id === id)) {
    return { ok: true, duplicate: true, id };
  }
  const last = store.conversation[store.conversation.length - 1];
  if (last && last.speaker === speaker && last.role === role) {
    const dt = Date.parse(timestamp) - Date.parse(last.timestamp || 0);
    if (Number.isFinite(dt) && shouldMergeUtterance(last.text, text, dt)) {
      last.text = pickMergedText(last.text, text);
      last.addressed_to = addressed_to || last.addressed_to;
      last.timestamp = timestamp;
      return { ok: true, merged: true, duplicate: false, id: last.id, turn: last };
    }
  }
  const row = { id, speaker, role, text, addressed_to, timestamp };
  store.conversation.push(row);
  store.conversation = cap(store.conversation);
  return { ok: true, duplicate: false, id, turn: row };
}

export function ingestAppEvent(store, event) {
  const type = String(event.type || "unknown");
  const source = String(event.source || "runtime");
  const severity = String(event.severity || "info");
  const payload = typeof event.payload === "string"
    ? event.payload
    : JSON.stringify(event.payload ?? {});
  const timestamp = event.timestamp || new Date().toISOString();
  const id = hashTurn({ speaker: source, role: type, text: payload.slice(0, 400), timestamp });
  if (store.events.some((e) => e.id === id)) {
    return { ok: true, duplicate: true, id };
  }
  const row = { id, type, source, severity, payload: payload.slice(0, 4000), timestamp };
  store.events.push(row);
  store.events = cap(store.events);
  return { ok: true, duplicate: false, id, event: row };
}

export function readEventLog(store, { since, types, severity, limit } = {}) {
  const minSev = ["debug", "info", "warn", "error", "critical"];
  const minIdx = minSev.indexOf(String(severity || "debug"));
  const typeSet = types
    ? new Set(String(types).split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  const max = Math.min(200, Math.max(1, Number(limit) || 50));
  let rows = store.events.slice();
  if (since) rows = rows.filter((e) => e.timestamp >= since);
  if (typeSet) rows = rows.filter((e) => typeSet.has(e.type));
  if (minIdx > 0) {
    rows = rows.filter((e) => minSev.indexOf(e.severity) >= minIdx);
  }
  return rows.slice(-max);
}

export function readConversationLog(store, { since, speaker, limit } = {}) {
  const max = Math.min(200, Math.max(1, Number(limit) || 50));
  let rows = store.conversation.slice();
  if (since) rows = rows.filter((t) => t.timestamp >= since);
  if (speaker) rows = rows.filter((t) => t.speaker === speaker);
  return rows.slice(-max);
}

export function setSnapshot(store, snapshot) {
  store.snapshot = {
    ...(snapshot && typeof snapshot === "object" ? snapshot : {}),
    updatedAt: new Date().toISOString(),
    mode: store.mode,
    activeAgentId: store.activeAgentId,
  };
  return store.snapshot;
}

export function getSnapshot(store) {
  return {
    ...(store.snapshot || {}),
    mode: store.mode,
    activeAgentId: store.activeAgentId,
    agentIds: Object.keys(store.agents || {}),
    updatedAt: store.snapshot?.updatedAt || null,
  };
}

export function appendImprovement(store, rec) {
  const now = new Date().toISOString();
  const row = {
    id: newId("imp"),
    title: String(rec.title || "").trim(),
    symptom: String(rec.symptom || "").trim(),
    internal_cause: String(rec.internal_cause || "").trim(),
    evidence: String(rec.evidence || "").trim(),
    proposed_fix: String(rec.proposed_fix || "").trim(),
    target: rec.target === "app" || rec.target === "process" ? rec.target : "agent",
    agent_id: rec.agent_id || store.activeAgentId || null,
    files: rec.files || "",
    status: "open",
    createdAt: now,
  };
  store.improvements.push(row);
  store.improvements = cap(store.improvements);
  return row;
}

export function readImprovementLog(store, { status = "all", limit } = {}) {
  const max = Math.min(200, Math.max(1, Number(limit) || 50));
  let rows = store.improvements.slice();
  if (status && status !== "all") rows = rows.filter((r) => r.status === status);
  return rows.slice(-max);
}

export function applyPlaybookPatch(store, { agent_id, patch, reason }) {
  const agent = getAgent(store, agent_id);
  if (!agent) {
    const err = new Error(`unknown agent_id: ${agent_id}`);
    err.status = 404;
    throw err;
  }
  const text = String(patch || "").trim();
  if (!text) {
    const err = new Error("patch required");
    err.status = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const block = [
    "",
    `## Kernel patch (${now})`,
    reason ? `Reason: ${String(reason).trim()}` : "",
    "",
    text,
    "",
  ].filter((l) => l !== null).join("\n");
  agent.playbook = `${agent.playbook || ""}\n${block}`.trim() + "\n";
  agent.version = Number(agent.version || 1) + 1;
  agent.updatedAt = now;
  agent.reloadRequested = true;
  store.agents[agent.agent_id] = agent;
  ingestAppEvent(store, {
    type: "playbook.updated",
    source: "agent",
    severity: "info",
    payload: JSON.stringify({ agent_id: agent.agent_id, version: agent.version }),
    timestamp: now,
  });
  return {
    ok: true,
    agent_id: agent.agent_id,
    version: agent.version,
    reload: true,
    playbook: agent.playbook,
  };
}

export function markReloaded(store, agentId) {
  const agent = getAgent(store, agentId);
  if (!agent) return null;
  agent.reloadRequested = false;
  store.agents[agent.agent_id] = agent;
  return agent;
}

export function proposeCodeChange(store, rec) {
  const row = {
    id: newId("prop"),
    title: String(rec.title || "").trim(),
    files: String(rec.files || "").trim(),
    diff: String(rec.diff || ""),
    reason: String(rec.reason || "").trim(),
    status: "staged",
    createdAt: new Date().toISOString(),
  };
  store.proposals.push(row);
  store.proposals = cap(store.proposals);
  return row;
}

export function findProposal(store, proposalId) {
  return store.proposals.find((p) => p.id === proposalId) || null;
}

export function deliverReport(store, rec) {
  const row = {
    id: newId("rep"),
    kind: rec.kind || "snapshot",
    audience: rec.audience || "operator",
    summary: String(rec.summary || "").trim(),
    createdAt: new Date().toISOString(),
  };
  store.reports.push(row);
  store.reports = cap(store.reports);
  return row;
}

export { newId, LOG_CAP, MODES };
