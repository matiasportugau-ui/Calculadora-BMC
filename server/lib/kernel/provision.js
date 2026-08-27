/**
 * provisionAgent — factory for a supervised voice agent.
 * Copies the contract (own playbook + calc tools later at mint), never Kernel's playbook.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadStore,
  saveStore,
  slugAgentId,
  registerAgent,
  getAgent,
  listAgents,
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "agentPlaybookTemplate.md");

const PANELIN_PLAYBOOK = `## Role & Persona
You are Panelin BMC, the in-app sales voice of Calculadora / BMC Uruguay.
You speak short Rioplatense Spanish. You never invent calculation results: call the engine tool first.

## Identity
- agent_id: panelin
- language: es
- Kernel (Núcleo) is a separate silent supervisor. Do not impersonate Kernel.

## CRITICAL INSTRUCTIONS
ALWAYS emit every user-visible number from the calc tool.
If Kernel later patches this playbook, obey the new text immediately.
Use the Calculadora tools attached to this session. Keep turns short.

Ignore non-speech: "shh", coughs, "ok", "look", TV/English bleed. Do not reply. Stay silent until a real Spanish request.
Never loop on the same filler. If the operator repeats "shh" or noise, produce ZERO audio.
You are Panelin BMC, not Kernel. If they ask to change the voice agent, tell them to use the selector "Agente supervisado" above before starting the call — do not invent a prompt instead of that control.
`;

export function renderPlaybook({ name, role, language = "es", agent_id }) {
  let tpl = "";
  try {
    tpl = fs.readFileSync(TEMPLATE_PATH, "utf8");
  } catch {
    tpl = `## Role & Persona
You are {{name}}. {{role}}.
You speak short. You never invent calculation results: call the engine tool first.

## CRITICAL INSTRUCTIONS
ALWAYS emit every user-visible number from the calc tool.
If Kernel later patches this playbook, obey the new text immediately.
`;
  }
  return tpl
    .replaceAll("{{name}}", name)
    .replaceAll("{{role}}", role)
    .replaceAll("{{language}}", language === "en" ? "en" : "es")
    .replaceAll("{{agent_id}}", agent_id);
}

export function refreshPanelinPlaybook(store = loadStore()) {
  seedPanelin(store);
  if (!store.agents.panelin) return null;
  store.agents.panelin.playbook = PANELIN_PLAYBOOK;
  store.agents.panelin.version = 1;
  store.agents.panelin.reloadRequested = false;
  store.agents.panelin.updatedAt = new Date().toISOString();
  return store.agents.panelin;
}

export function seedPanelin(store = loadStore()) {
  if (store.agents.panelin) return getAgent(store, "panelin");
  const agent = registerAgent(store, {
    agent_id: "panelin",
    name: "Panelin BMC",
    role: "vendedor interno BMC Uruguay / METALOG SAS",
    language: "es",
    playbook: PANELIN_PLAYBOOK,
  });
  store.activeAgentId = store.activeAgentId || "panelin";
  saveStore(store);
  return agent;
}

export function provisionAgent(input = {}) {
  const name = String(input.name || "").trim();
  const role = String(input.role || "").trim();
  const language = input.language === "en" ? "en" : "es";
  if (!name || !role) {
    const err = new Error("name and role required");
    err.status = 400;
    throw err;
  }
  const store = loadStore();
  seedPanelin(store);
  const agent_id = slugAgentId(name);
  if (store.agents[agent_id]) {
    const err = new Error(`agent_id already registered: ${agent_id}`);
    err.status = 409;
    throw err;
  }
  const playbook = renderPlaybook({ name, role, language, agent_id });
  const agent = registerAgent(store, {
    agent_id,
    name,
    role,
    language,
    playbook,
  });
  store.activeAgentId = agent_id;
  saveStore(store);
  return {
    agent_id,
    name: agent.name,
    role: agent.role,
    language: agent.language,
    playbook_url: agent.playbook_url,
    version: agent.version,
    playbook: agent.playbook,
  };
}

export function listSupervisedAgents() {
  const store = loadStore();
  seedPanelin(store);
  return {
    activeAgentId: store.activeAgentId,
    mode: store.mode,
    agents: listAgents(store).map((a) => ({
      agent_id: a.agent_id,
      name: a.name,
      role: a.role,
      language: a.language,
      version: a.version,
      playbook_url: a.playbook_url,
      reloadRequested: !!a.reloadRequested,
      updatedAt: a.updatedAt,
    })),
  };
}

export { PANELIN_PLAYBOOK };
