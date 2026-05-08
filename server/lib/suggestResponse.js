/**
 * suggestResponse.js — Thin adapter over agentCore for ML / CRM dashboard.
 * All AI logic, KB retrieval, and system prompt building lives in agentCore.js.
 */
import { callAgentOnce } from "./agentCore.js";
import { normalizeSurface, surfaceToChannel, channelToDefaultSurface } from "./surface.js";

export const AI_PROVIDER_RANKING = ["claude", "openai", "grok", "gemini"];

/**
 * Generate a sales response for a CRM / ML question.
 * Delegates to the unified Panelin agent with the correct channel rules.
 *
 * Channel resolution (precedence):
 *   1. explicit `surface` arg → surfaceToChannel
 *   2. normalizeSurface({ origen, observaciones }) → surfaceToChannel
 *   3. "wa" (sane default for non-ML CRM channels)
 *
 * @param {{ consulta, origen, cliente, producto, observaciones, provider, surface }} opts
 * @returns {Promise<{ text: string, provider: string, model?: string, latencyMs?: number }>}
 */
export async function generateAiResponse({
  consulta, origen, cliente, producto, observaciones, provider, surface,
  apiKeys: apiKeysOverride = null,
}) {
  const detectedSurface =
    normalizeSurface(surface)
    ?? normalizeSurface({ origen, observaciones })
    ?? channelToDefaultSurface("wa");
  const channel = surfaceToChannel(detectedSurface);

  const userContent = [
    cliente       ? `Cliente: ${cliente}`       : null,
    producto      ? `Publicación: ${producto}`  : null,
    observaciones ? `Contexto: ${observaciones}` : null,
    `Consulta: ${consulta}`,
  ].filter(Boolean).join("\n");

  return callAgentOnce(
    [{ role: "user", content: userContent }],
    { channel, provider, apiKeys: apiKeysOverride },
  );
}
