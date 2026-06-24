/**
 * Mirror ML send-approved outbound to omni graph
 */
import { mlAgentReplyToOmniEvent } from "./mlCrmRow.js";
import { shadowPersist } from "../normalizer.js";

export async function mirrorMlSendApprovedToOmni({ config, logger, questionId, text, agentId }) {
  if (!config.omniMlShadowWrite) return null;
  const event = mlAgentReplyToOmniEvent({ questionId, text, agentId });
  if (!event) return null;
  return shadowPersist(event, { databaseUrl: config.databaseUrl, logger });
}
