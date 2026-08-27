/**
 * Grok Voice often emits several input_audio_transcription.completed events
 * for one spoken sentence: growing prefixes, then the same final 2–3 times.
 * Keep a single user bubble / ingest row per utterance.
 */

export const COALESCE_WINDOW_MS = 4000;

export function normalizeUtterance(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestCommonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

export function shouldMergeUtterance(prevText, nextText, dtMs, windowMs = COALESCE_WINDOW_MS) {
  if (dtMs < 0 || dtMs > windowMs) return false;
  const a = normalizeUtterance(prevText);
  const b = normalizeUtterance(nextText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.startsWith(a) || a.startsWith(b)) return true;
  // ASR self-correction: "está" → "estoy" still the same sentence growing.
  const shorter = a.length <= b.length ? a : b;
  const lcp = longestCommonPrefixLength(a, b);
  if (lcp >= Math.max(10, Math.floor(0.5 * shorter.length))) return true;
  const wa = a.split(" ");
  const wb = b.split(" ");
  const wShort = wa.length <= wb.length ? wa : wb;
  const wLong = wa.length <= wb.length ? wb : wa;
  if (wShort.length >= 3 && wShort.slice(0, 3).every((w, i) => w === wLong[i])) {
    return true;
  }
  // One ASR substitution (Kernel vs canal) with the rest of the sentence shared.
  let i = 0;
  const n = Math.min(wa.length, wb.length);
  while (i < n && wa[i] === wb[i]) i += 1;
  if (i < n) {
    const restA = wa.slice(i + 1).join(" ");
    const restB = wb.slice(i + 1).join(" ");
    if (restA.length >= 20 && (restB.startsWith(restA) || restA.startsWith(restB) || restA === restB)) {
      return true;
    }
  }
  return false;
}

export function pickMergedText(prevText, nextText) {
  const a = String(prevText || "");
  const b = String(nextText || "");
  if (!a) return b;
  if (!b) return a;
  const na = normalizeUtterance(a);
  const nb = normalizeUtterance(b);
  if (nb.length >= na.length) return b;
  return a;
}

/**
 * @param {Array<{ role: string, text: string, at?: number }>} prev
 * @param {string} text
 * @param {number} [now]
 */
export function coalesceUserTranscript(prev, text, now = Date.now()) {
  const lines = Array.isArray(prev) ? prev : [];
  const nextText = String(text || "").trim();
  if (!nextText) return lines;
  const last = lines[lines.length - 1];
  if (!last || last.role !== "user") {
    return [...lines, { role: "user", text: nextText, at: now }];
  }
  const dt = now - (Number(last.at) || 0);
  if (!shouldMergeUtterance(last.text, nextText, dt)) {
    return [...lines, { role: "user", text: nextText, at: now }];
  }
  const merged = [...lines];
  merged[merged.length - 1] = {
    ...last,
    text: pickMergedText(last.text, nextText),
    at: now,
  };
  return merged;
}
