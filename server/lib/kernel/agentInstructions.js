/**
 * Live agent prompt used by mint and playbook reload.
 * Factory agents speak their playbook; Panelin keeps the Voice Brain Pack
 * and only appends living patches after version > 1.
 */
import { buildVoiceBrainPack } from "../voiceBrainPack.js";

export function buildSupervisedAgentPrompt(agent, brainPack) {
  if (!agent || agent.agent_id === "panelin") {
    if (agent && Number(agent.version) > 1) {
      return `${brainPack.instructions}\n\n# Living playbook patches\n${agent.playbook}`;
    }
    return brainPack.instructions;
  }
  return agent.playbook || brainPack.instructions;
}

export function buildAgentReloadPayload(agent, calcState = {}, { devMode = false } = {}) {
  const brainPack = buildVoiceBrainPack(calcState || {}, { devMode, leadContext: null });
  return {
    agent_id: agent.agent_id,
    version: agent.version,
    playbook: agent.playbook,
    instructions: buildSupervisedAgentPrompt(agent, brainPack),
  };
}
