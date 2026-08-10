/**
 * Llamada a modelos de IA con la misma cadena de fallback que POST /api/crm/suggest-response.
 * Uso desde scripts o rutas que necesiten un único completion sin duplicar lógica.
 */
import { getProviderChain, resolveModel, getApiKey, estimateCostUSD } from "./aiProviderConfig.js";
import { logAgentCost } from "./costTelemetry.js";
import { PROVIDER_TIMEOUT_MS } from "./providerCircuitBreaker.js";

const DEFAULT_RANKING = getProviderChain(true); // prefer fast models for completion paths

/**
 * Hard timeout per provider attempt — same contract as agentCore.callWithTimeout.
 * Aborts via AbortSignal AND rejects via race so a hung SDK cannot block failover
 * (teamAssist previously had a 30s AbortController; callAiCompletion had none).
 *
 * @param {(signal: AbortSignal) => Promise<T>} fn
 * @param {string} label
 * @returns {Promise<T>}
 * @template T
 */
async function withProviderTimeout(fn, label) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        Object.assign(new Error(`${label} timed out after ${PROVIDER_TIMEOUT_MS}ms`), {
          code: "PROVIDER_TIMEOUT",
        }),
      );
    }, PROVIDER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(fn(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

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
    claude: getApiKey("claude"),
    openai: getApiKey("openai"),
    grok: getApiKey("grok"),
    gemini: getApiKey("gemini"),
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
      let msg = null;
      let completion = null;

      const model = resolveModel(p, undefined, true); // prefer fast models for these paths

      if (p === "claude") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthropic = new Anthropic({ apiKey });
        msg = await withProviderTimeout(
          (signal) =>
            anthropic.messages.create(
              {
                model,
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [{ role: "user", content: userMessage }],
              },
              { signal },
            ),
          "claude",
        );
        text = msg.content[0]?.text || "";
      } else if (p === "openai") {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey });
        completion = await withProviderTimeout(
          (signal) =>
            openai.chat.completions.create(
              {
                model,
                max_tokens: maxTokens,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userMessage },
                ],
              },
              { signal },
            ),
          "openai",
        );
        text = completion.choices[0]?.message?.content || "";
      } else if (p === "grok") {
        const { default: OpenAI } = await import("openai");
        const grok = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
        completion = await withProviderTimeout(
          (signal) =>
            grok.chat.completions.create(
              {
                model,
                max_tokens: maxTokens,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userMessage },
                ],
              },
              { signal },
            ),
          "grok",
        );
        text = completion.choices[0]?.message?.content || "";
      } else if (p === "gemini") {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(apiKey);
        const modelInstance = genai.getGenerativeModel({ model });
        const result = await withProviderTimeout(
          (signal) =>
            modelInstance.generateContent(`${systemPrompt}\n\n${userMessage}`, { signal }),
          "gemini",
        );
        text = result.response.text() || "";
      }

      if (text.trim()) {
        const usage = completion?.usage || msg?.usage || {};
        const cost = estimateCostUSD(p, model, usage);
        logAgentCost({
          event: "ai_completion",
          provider: p,
          model,
          input_tokens: usage.input_tokens || usage.prompt_tokens || 0,
          output_tokens: usage.output_tokens || usage.completion_tokens || 0,
          estimated_cost_usd: cost,
          source: "aiCompletion",
        });
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
