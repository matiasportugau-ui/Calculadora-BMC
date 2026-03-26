/**
 * Llamada a modelos de IA con la misma cadena de fallback que POST /api/crm/suggest-response.
 * Uso desde scripts o rutas que necesiten un único completion sin duplicar lógica.
 */
import { config } from "../config.js";

const DEFAULT_RANKING = ["grok", "claude", "openai", "gemini"];

/**
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userMessage
 * @param {number} [opts.maxTokens]
 * @param {string[]|null} [opts.ranking] — override del orden de proveedores
 * @param {string|null} [opts.provider] — si se pasa, solo ese proveedor
 * @returns {Promise<{ text: string, provider: string }>}
 */
export async function callAiCompletion({
  systemPrompt,
  userMessage,
  maxTokens = 1500,
  ranking = DEFAULT_RANKING,
  provider = null,
}) {
  const chain = provider ? [provider] : ranking;
  const apiKeys = {
    claude: config.anthropicApiKey,
    openai: config.openaiApiKey,
    grok: config.grokApiKey,
    gemini: config.geminiApiKey,
  };

  const errors = [];

  for (const p of chain) {
    const apiKey = apiKeys[p];
    if (!apiKey) {
      errors.push(`${p}: no key`);
      continue;
    }

    try {
      let text = "";

      if (p === "claude") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey });
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });
        text = msg.content[0]?.text || "";
      } else if (p === "openai") {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        });
        text = completion.choices[0]?.message?.content || "";
      } else if (p === "grok") {
        const { default: OpenAI } = await import("openai");
        const grok = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
        const completion = await grok.chat.completions.create({
          model: "grok-3-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        });
        text = completion.choices[0]?.message?.content || "";
      } else if (p === "gemini") {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(apiKey);
        const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(`${systemPrompt}\n\n${userMessage}`);
        text = result.response.text() || "";
      }

      if (text.trim()) {
        return { text: text.trim(), provider: p };
      }
      errors.push(`${p}: empty response`);
    } catch (e) {
      errors.push(`${p}: ${e.message?.slice(0, 120) || e}`);
    }
  }

  const err = new Error("All AI providers failed");
  err.details = errors;
  throw err;
}
