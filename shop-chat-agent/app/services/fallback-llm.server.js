/**
 * Fallback assistant when the primary model (Claude) fails or is misconfigured.
 * Optional: OPENAI_API_KEY + FALLBACK_OPENAI_MODEL for a short text-only reply (no MCP tools).
 */
import OpenAI from "openai";

/** @returns {string} */
function staticFallbackMessage() {
  return (
    process.env.FALLBACK_STATIC_MESSAGE?.trim() ||
    "I’m having trouble reaching our assistant right now. You can use the store menu to browse products, open your cart, or read shipping and returns on our policy pages. Please try again in a moment."
  );
}

/**
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function getFallbackAssistantReply(userMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return staticFallbackMessage();
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.FALLBACK_OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are a concise storefront assistant. You cannot call tools or access live inventory. " +
            "Help with general guidance: suggest browsing the catalog, using the cart/checkout, and reading the store policy pages for shipping and returns. " +
            "Keep answers under 120 words.",
        },
        { role: "user", content: String(userMessage || "").slice(0, 4000) },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text || staticFallbackMessage();
  } catch (e) {
    console.error("fallback-llm: OpenAI completion failed:", e?.message || e);
    return staticFallbackMessage();
  }
}

export default { getFallbackAssistantReply };
