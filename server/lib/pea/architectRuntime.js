/**
 * ArchitectRuntime — unified L1–L2 loop (mock or live LLM per PEA_ARCHITECT_MOCK).
 */
import {
  buildMockArchitectPacket,
  finalizePacketWithCritic,
  routeLane,
  saveEvolutionPacket,
} from "./evolutionPackets.js";
import { buildLlmArchitectPacket } from "./architectLlm.js";

/**
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} config
 * @param {{ gap: object, analysisRunId?: string, forceMock?: boolean }} ctx
 */
export async function runArchitectRuntime(pool, config, ctx) {
  const { gap } = ctx;
  const forceMock = ctx.forceMock ?? config.peaArchitectMock;
  const laneInfo = routeLane(gap);
  const exploreNotes =
    `Evidencia: SDD §6, tool=${gap.metadata?.tool_id || "n/a"}, fingerprint=${gap.fingerprint?.slice(0, 8)}…`;

  let draft;
  if (forceMock) {
    draft = buildMockArchitectPacket(gap, laneInfo, exploreNotes);
  } else {
    try {
      draft = await buildLlmArchitectPacket(gap, laneInfo, exploreNotes, config);
    } catch {
      draft = buildMockArchitectPacket(gap, laneInfo, exploreNotes);
      draft.payload = { ...(draft.payload || {}), llm_fallback: true };
    }
  }
  draft = finalizePacketWithCritic(draft, gap);

  if (draft.status !== "ready_for_review") {
    return {
      ok: false,
      reason: "critic_failed",
      critic: draft.critic_result,
      packet: draft,
    };
  }

  const saved = await saveEvolutionPacket(pool, draft);
  return {
    ok: true,
    packetId: saved.id,
    status: saved.status,
    primary_lane: saved.primary_lane,
    critic: draft.critic_result,
  };
}
