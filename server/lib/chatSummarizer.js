import { callAiCompletion } from "./aiCompletion.js";

const SUMMARY_TRIGGER = 12; // messages before summarization kicks in
const KEEP_RECENT = 4;       // always keep last N messages verbatim

/**
 * Summarize long conversation history to save token budget.
 * Returns { summarized: boolean, messages: Array }
 */
export async function summarizeHistory(messages) {
  if (!Array.isArray(messages) || messages.length <= SUMMARY_TRIGGER) {
    return { summarized: false, messages };
  }

  const recentMsgs = messages.slice(-KEEP_RECENT);
  const olderMsgs = messages.slice(0, -KEEP_RECENT);

  const transcript = olderMsgs
    .map((m) => `${m.role === "user" ? "Usuario" : "Panelin"}: ${m.content}`)
    .join("\n");

  try {
    const { text: summary } = await callAiCompletion({
      systemPrompt: "Sos un asistente de resumen. Resumí en 3-4 oraciones concisas la conversación, enfocándote en: paneles confirmados, dimensiones, precios y decisiones tomadas. Sé breve y factual.",
      userMessage: transcript.slice(0, 6000),
      maxTokens: 300,
    });

    const summaryMessage = {
      role: "system",
      content: `[RESUMEN DE CONVERSACIÓN PREVIA]: ${summary}`,
    };

    return { summarized: true, messages: [summaryMessage, ...recentMsgs] };
  } catch {
    // Summarization failed — return full history untouched so no context is silently lost
    return { summarized: false, messages };
  }
}
