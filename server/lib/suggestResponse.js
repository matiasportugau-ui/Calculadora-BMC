/**
 * suggestResponse.js — Thin adapter over agentCore for ML / CRM dashboard.
 * All AI logic, KB retrieval, and system prompt building lives in agentCore.js.
 */
import { callAgentOnce } from "./agentCore.js";

export const AI_PROVIDER_RANKING = ["claude", "openai", "grok", "gemini"];

/**
 * Generate a sales response for a CRM / ML question.
 * Delegates to the unified Panelin agent with channel="ml" or "wa".
 *
 * @param {{ consulta, origen, cliente, producto, observaciones, provider, config }} opts
 * @returns {Promise<{ text: string, provider: string }>}
 */
export async function generateAiResponse({ consulta, origen, cliente, producto, observaciones, provider }) {
  const channel = /ML|mercado/i.test(origen || "") ? "ml" : "wa";

  const userContent = [
    cliente      ? `Cliente: ${cliente}` : null,
    producto     ? `Publicación: ${producto}` : null,
    observaciones ? `Contexto: ${observaciones}` : null,
    `Consulta: ${consulta}`,
  ].filter(Boolean).join("\n");

  return callAgentOnce(
    [{ role: "user", content: userContent }],
    { channel, provider },
  );
}
