/**
 * server/lib/suggestResponse.js
 * Shared AI response generation — used by bmcDashboard route and mlAutoAnswer pipeline.
 */

const SYSTEM_PROMPT =
  "Sos el asistente de ventas de BMC Uruguay (METALOG SAS), empresa que vende paneles de " +
  "aislamiento térmico: Isodec EPS/PIR (techos), Isopanel EPS/PIR (paredes/fachadas), " +
  "Isoroof 3G/Plus/Foil. Precios en USD/m² IVA incluido. Cuando no tenés el precio exacto, " +
  "pedí medidas y uso para cotizar. Respondés en español rioplatense, breve y profesional. " +
  'Cerrás siempre con "Saludos BMC URUGUAY!"';

export const AI_PROVIDER_RANKING = ["claude", "openai", "grok", "gemini"];

/**
 * Generate an AI sales response for a CRM / ML question.
 *
 * @param {{ consulta, origen, cliente, producto, observaciones, provider, config }} opts
 * @returns {Promise<{ text: string, provider: string }>}
 * @throws Error with .code "IA_NOT_CONFIGURED" | "ALL_PROVIDERS_FAILED"
 */
export async function generateAiResponse({ consulta, origen, cliente, producto, observaciones, provider, config }) {
  const apiKeys = {
    claude: config.anthropicApiKey,
    openai: config.openaiApiKey,
    grok:   config.grokApiKey,
    gemini: config.geminiApiKey,
  };

  if (!Object.values(apiKeys).some((k) => String(k || "").trim().length > 0)) {
    throw Object.assign(new Error("IA_NOT_CONFIGURED"), { code: "IA_NOT_CONFIGURED" });
  }

  const chain = provider ? [provider] : AI_PROVIDER_RANKING;
  const userMsg = [
    `Canal: ${origen || "desconocido"}`,
    `Cliente: ${cliente || "desconocido"}`,
    producto      ? `Producto/publicación: ${producto}` : null,
    observaciones ? `Observaciones: ${observaciones}`   : null,
    `Consulta: ${consulta}`,
  ].filter(Boolean).join("\n");

  const errors = [];

  for (const p of chain) {
    const apiKey = apiKeys[p];
    if (!apiKey) { errors.push(`${p}: no key`); continue; }
    try {
      let text = "";

      if (p === "claude") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey });
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        });
        text = msg.content[0]?.text || "";

      } else if (p === "openai") {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 300,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
        });
        text = completion.choices[0]?.message?.content || "";

      } else if (p === "grok") {
        const { default: OpenAI } = await import("openai");
        const grok = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
        const completion = await grok.chat.completions.create({
          model: "grok-3-mini",
          max_tokens: 300,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
        });
        text = completion.choices[0]?.message?.content || "";

      } else if (p === "gemini") {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(apiKey);
        const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${userMsg}`);
        text = result.response.text() || "";
      }

      if (text.trim()) return { text: text.trim(), provider: p };
      errors.push(`${p}: empty response`);

    } catch (err) {
      errors.push(`${p}: ${err.message?.slice(0, 80)}`);
    }
  }

  const e = new Error(`All AI providers failed: ${errors.join("; ")}`);
  e.code = "ALL_PROVIDERS_FAILED";
  e.errors = errors;
  throw e;
}
