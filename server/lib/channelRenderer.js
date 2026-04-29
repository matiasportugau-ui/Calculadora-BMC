/**
 * channelRenderer.js — Per-channel text adapter for KB answers.
 *
 * Single source of truth: entry.goodAnswer (rich, unlimited).
 * Channel overrides: entry.goodAnswerML / entry.goodAnswerWA (optional, hand-crafted).
 * Adapter: strips markdown, truncates at sentence boundary, normalizes tone.
 */

export const CHANNEL_LIMITS = {
  ml:      { maxChars: 350, stripMarkdown: true,  emoji: false },
  wa:      { maxChars: 800, stripMarkdown: true,  emoji: true  },
  chat:    { maxChars: null, stripMarkdown: false, emoji: true  },
};

/**
 * Strip common markdown from text without a full parser.
 * Keeps the semantic content, removes formatting characters.
 */
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")        // bold
    .replace(/\*(.*?)\*/g, "$1")             // italic
    .replace(/`{1,3}(.*?)`{1,3}/gs, "$1")   // inline code / code blocks
    .replace(/^#{1,6}\s+/gm, "")            // headers
    .replace(/^\s*[-*•]\s+/gm, "- ")        // normalize bullet points
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → label only
    .replace(/\n{3,}/g, "\n\n")              // collapse excess blank lines
    .trim();
}

/**
 * Truncate at the last sentence boundary before maxChars.
 * Falls back to hard cut with ellipsis if no boundary found.
 */
function truncateAtSentence(text, maxChars) {
  if (text.length <= maxChars) return text;
  const boundary = text.lastIndexOf(".", maxChars - 3);
  if (boundary > maxChars * 0.55) return text.slice(0, boundary + 1).trim();
  const wordBoundary = text.lastIndexOf(" ", maxChars - 3);
  if (wordBoundary > 0) return text.slice(0, wordBoundary).trim() + "…";
  return text.slice(0, maxChars - 1).trim() + "…";
}

/**
 * Render a KB entry's answer for a specific channel.
 * Precedence: channelOverride → adapter(goodAnswer).
 *
 * @param {object} entry  KB entry with goodAnswer, goodAnswerML?, goodAnswerWA?
 * @param {"chat"|"ml"|"wa"} channel
 * @returns {string}
 */
export function renderEntryForChannel(entry, channel) {
  const rules = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.chat;

  // Use hand-crafted override when available
  const override = channel === "ml" ? entry.goodAnswerML : channel === "wa" ? entry.goodAnswerWA : null;
  if (override && String(override).trim()) return String(override).trim();

  let text = String(entry.goodAnswer || "");
  if (rules.stripMarkdown) text = stripMarkdown(text);
  if (rules.maxChars) text = truncateAtSentence(text, rules.maxChars);
  return text;
}

/**
 * Check if an entry needs a manual ML override (too long for auto-truncation to be safe).
 * Used to compute mlGap health metric and UI badges.
 */
export function entryNeedsMLOverride(entry) {
  if (entry.goodAnswerML && String(entry.goodAnswerML).trim()) return false;
  const autoRendered = renderEntryForChannel(entry, "ml");
  // Flag if auto-truncation removed more than 20% of the original
  return autoRendered.length < String(entry.goodAnswer || "").length * 0.8;
}

/**
 * Render a set of KB examples for injection into a system prompt,
 * using the channel-appropriate text for each entry.
 *
 * @param {Array} examples  from findRelevantExamples()
 * @param {"chat"|"ml"|"wa"} channel
 * @returns {string}  formatted block for system prompt injection
 */
export function renderExamplesBlock(examples, channel) {
  if (!examples || examples.length === 0) return "";
  const lines = examples.map((e, i) =>
    `Q${i + 1}: ${e.question}\nA${i + 1}: ${renderEntryForChannel(e, channel)}`
  );
  return `## EJEMPLOS DE RESPUESTAS ANTERIORES (canal: ${channel})\n${lines.join("\n\n")}`;
}
