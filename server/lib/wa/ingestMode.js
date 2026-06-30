/**
 * Single decision point for the WA "flip" (ADR-009).
 * @param {{ omniWaCanonical?: boolean }} config
 * @returns {"canonical"|"legacy"}
 *   "canonical" → Omni event bus is the source of truth (awaited normalizeAndPersist
 *                 → wa_crm_sync job); legacy in-memory map + 5-min timer + 🚀 + the
 *                 duplicate callAgentOnce are disabled.
 *   "legacy"    → today's behaviour: in-memory map + processWaConversation + Omni
 *                 shadow-write.
 */
export function chooseWaIngestMode(config) {
  return config?.omniWaCanonical ? "canonical" : "legacy";
}
