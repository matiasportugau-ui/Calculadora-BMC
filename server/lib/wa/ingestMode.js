/**
 * Single decision point for the WA "flip" (ADR-009).
 * @param {{ omniWaCanonical?: boolean, omniEventBusEnabled?: boolean, omniAiOrchestratorEnabled?: boolean }} config
 * @returns {"canonical"|"legacy"}
 *   "canonical" → Omni event bus is the source of truth (awaited normalizeAndPersist
 *                 → wa_crm_sync job); legacy in-memory map + 5-min timer + 🚀 + the
 *                 duplicate callAgentOnce are disabled.
 *   "legacy"    → today's behaviour: in-memory map + processWaConversation + Omni
 *                 shadow-write.
 *
 * Canonical requires the whole Omni job pipeline to be live: the event bus must fan
 * out normalizeAndPersist events and the AI orchestrator must drain the `wa_crm_sync`
 * job. If either is OFF, enabling omniWaCanonical alone would disable the legacy path
 * while NOTHING enqueues/processes the job — inbound WA leads would be silently
 * dropped. So we only flip to canonical when all three are ON; otherwise we fall back
 * to legacy (which still captures every lead). See config.js:307.
 */
export function chooseWaIngestMode(config) {
  const canonical =
    !!config?.omniWaCanonical &&
    !!config?.omniEventBusEnabled &&
    !!config?.omniAiOrchestratorEnabled;
  return canonical ? "canonical" : "legacy";
}
