/**
 * Anti-repetition module for the Panelin AI agent.
 *
 * Analyzes recent assistant messages in a conversation to detect repetitive
 * patterns and generate prompt-level instructions that steer the LLM away
 * from repeating itself.
 */

/** Default Jaccard similarity threshold above which two messages are considered repetitive */
const DEFAULT_REPETITION_THRESHOLD = 0.55;
/** Default number of recent assistant messages to analyze */
const DEFAULT_WINDOW_SIZE = 6;
/** Minimum word length for phrase extraction */
const MIN_WORD_LENGTH = 3;

/**
 * Extract words of at least `minLength` characters from text.
 * @param {string} text
 * @param {number} [minLength]
 * @returns {string[]}
 */
function extractWords(text, minLength = MIN_WORD_LENGTH) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\wáéíóúñü\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= minLength);
}

/**
 * Analyze recent conversation turns for repetition patterns.
 * Returns instructions to inject into the system prompt.
 *
 * @param {Array<{role: string, content: string}>} messages — recent conversation history
 * @param {{ threshold?: number, windowSize?: number }} opts
 * @returns {{ hasRepetition: boolean, instructions: string, patterns: string[] }}
 */
export function buildAntiRepetitionContext(messages = [], opts = {}) {
  const { threshold = DEFAULT_REPETITION_THRESHOLD, windowSize = DEFAULT_WINDOW_SIZE } = opts;

  const assistantMsgs = messages
    .filter((m) => m.role === "assistant" && m.content && m.content.length >= 30)
    .slice(-windowSize);

  if (assistantMsgs.length < 2) {
    return { hasRepetition: false, instructions: "", patterns: [] };
  }

  const patterns = [];
  const repeatedPhrases = findRepeatedPhrases(assistantMsgs.map((m) => m.content));
  const structuralRepetition = detectStructuralRepetition(assistantMsgs.map((m) => m.content));

  // Check pairwise similarity in the recent window
  let maxSim = 0;
  for (let i = 1; i < assistantMsgs.length; i++) {
    const sim = jaccardSimilarity(assistantMsgs[i].content, assistantMsgs[i - 1].content);
    if (sim > maxSim) maxSim = sim;
    if (sim > threshold) {
      patterns.push(`Turnos ${i - 1}→${i}: similitud ${(sim * 100).toFixed(0)}%`);
    }
  }

  if (repeatedPhrases.length > 0) {
    patterns.push(`Frases repetidas: "${repeatedPhrases.slice(0, 3).join('", "')}"`);
  }

  if (structuralRepetition) {
    patterns.push("Estructura de respuesta repetitiva (mismo formato/orden)");
  }

  const hasRepetition = patterns.length > 0;
  let instructions = "";

  if (hasRepetition) {
    const avoidList = repeatedPhrases.length > 0
      ? `\nFrases a evitar reusar: ${repeatedPhrases.slice(0, 5).map((p) => `"${p}"`).join(", ")}`
      : "";

    instructions = `## DIRECTIVA ANTI-REPETICIÓN (ACTIVA)
Se detectaron patrones repetitivos en tus últimas respuestas. OBLIGATORIO:
1. NO repitas frases, párrafos o estructuras que ya usaste en esta conversación.
2. Variá el formato: si antes usaste lista con viñetas, ahora usá prosa o tabla.
3. Si ya diste una explicación, no la repitas — referenciala brevemente y avanzá.
4. Si el usuario repite la misma pregunta, respondé de forma diferente o preguntá qué parte no quedó clara.
5. Cada respuesta debe aportar información NUEVA o un ángulo distinto.${avoidList}`;
  }

  return { hasRepetition, instructions, patterns };
}

/**
 * Find phrases (3+ words) that appear in multiple assistant messages.
 * @param {string[]} texts
 * @returns {string[]}
 */
function findRepeatedPhrases(texts) {
  if (texts.length < 2) return [];

  const phraseCount = new Map();
  for (const text of texts) {
    const words = extractWords(text);
    const seen = new Set();
    for (let i = 0; i <= words.length - 3; i++) {
      const phrase = words.slice(i, i + 3).join(" ");
      if (!seen.has(phrase)) {
        seen.add(phrase);
        phraseCount.set(phrase, (phraseCount.get(phrase) || 0) + 1);
      }
    }
  }

  return [...phraseCount.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

/**
 * Detect if recent messages follow the same structural pattern (e.g., always start with greeting + bullet list).
 * @param {string[]} texts
 * @returns {boolean}
 */
function detectStructuralRepetition(texts) {
  if (texts.length < 3) return false;

  const patterns = texts.map((text) => {
    const lines = text.split("\n").filter((l) => l.trim());
    return lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) return "bullet";
      if (/^\d+[.)]\s/.test(trimmed)) return "numbered";
      if (trimmed.startsWith("#")) return "heading";
      if (trimmed.startsWith(">")) return "quote";
      if (trimmed.startsWith("ACTION_JSON:")) return "action";
      return "text";
    }).slice(0, 5).join(","); // first 5 structural elements
  });

  // If 3+ recent messages have the same structural pattern
  const last3 = patterns.slice(-3);
  return last3.length === 3 && last3[0] === last3[1] && last3[1] === last3[2];
}

/**
 * Jaccard similarity on 4-gram character shingles.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1
 */
function jaccardSimilarity(a, b) {
  if (!a || !b) return 0;
  const shingles = (text) => {
    const s = new Set();
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    for (let i = 0; i <= normalized.length - 4; i++) {
      s.add(normalized.slice(i, i + 4));
    }
    return s;
  };
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const s of sa) {
    if (sb.has(s)) intersection++;
  }
  return intersection / (sa.size + sb.size - intersection);
}
