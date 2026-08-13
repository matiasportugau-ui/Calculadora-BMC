/**
 * Apple TTS — Español (Argentina) first (Diego / Isabela).
 * Local API `/api/agent/speak` uses AVSpeech; browser speechSynthesis is fallback.
 */
import { getCalcApiBase } from "../utils/calcApiBase.js";

export const APPLE_TTS_VOICE_KEY = "panelin-apple-tts-voice-v1";

export const ARGENTINA_VOICES = [
  { name: "Diego (Argentina)", lang: "es-AR", id: "diego" },
  { name: "Isabela (Argentina)", lang: "es-AR", id: "isabela" },
];

export const DEFAULT_APPLE_TTS_VOICE = "Diego (Argentina)";

const SPAIN_NAME = /m[oó]nica|monica|jorge|enrique|marisol/i;
const MALE_LATAM = /eddy|rocko|reed|juan|diego|carlos|santiago/i;
const FEMALE_LATAM = /paulina|sabina|soledad|valeria|angelica|isabela/i;

const LANG_SCORE = [
  ["es-uy", 100],
  ["es-ar", 96],
  ["es-419", 84],
  ["es-mx", 80],
  ["es-us", 72],
  ["es-co", 70],
  ["es-cl", 68],
];

export function isSpainSpanishVoice(voice) {
  const lang = String(voice?.lang || "").toLowerCase();
  const name = String(voice?.name || "");
  if (lang.startsWith("es-es")) return true;
  if (/\bespaña\b|\bspain\b/i.test(name) && !/m[eé]xico|mexico|argentina|uruguay|latino/i.test(name)) {
    return true;
  }
  if (SPAIN_NAME.test(name) && !/m[eé]xico|mexico|argentina|uruguay/i.test(name)) return true;
  return false;
}

export function isLatamSpanishVoice(voice) {
  const lang = String(voice?.lang || "").toLowerCase();
  if (!lang.startsWith("es")) return false;
  if (isSpainSpanishVoice(voice)) return false;
  return true;
}

export function isArgentinaVoiceName(name) {
  const s = String(name || "").toLowerCase();
  return s.includes("diego") || s.includes("isabela") || s.includes("argent") || s.includes("es-ar");
}

export function argentinaVoiceId(name) {
  const s = String(name || "").toLowerCase();
  if (s.includes("isabela") || s.includes("isabel")) return "isabela";
  return "diego";
}

export function loadAppleTtsVoiceName() {
  if (typeof window === "undefined") return DEFAULT_APPLE_TTS_VOICE;
  try {
    return String(window.localStorage.getItem(APPLE_TTS_VOICE_KEY) || DEFAULT_APPLE_TTS_VOICE);
  } catch {
    return DEFAULT_APPLE_TTS_VOICE;
  }
}

export function saveAppleTtsVoiceName(name) {
  if (typeof window === "undefined") return;
  try {
    const v = String(name || "").trim();
    if (v) window.localStorage.setItem(APPLE_TTS_VOICE_KEY, v);
    else window.localStorage.removeItem(APPLE_TTS_VOICE_KEY);
  } catch {
    /* ignore */
  }
}

export function listLatamSpeechVoices(voices = []) {
  const extra = Array.isArray(voices) ? voices.filter(isLatamSpanishVoice) : [];
  const seen = new Set(ARGENTINA_VOICES.map((v) => v.name.toLowerCase()));
  const rest = extra.filter((v) => !seen.has(String(v.name || "").toLowerCase()));
  return [...ARGENTINA_VOICES, ...rest];
}

/**
 * @param {Array<{ lang?: string, name?: string, id?: string }>} voices
 * @param {{ preferredName?: string }} [opts]
 */
export function pickAppleSpanishVoice(voices = [], opts = {}) {
  const list = Array.isArray(voices) ? voices : [];
  const preferred = String(opts.preferredName || "").trim().toLowerCase();
  if (preferred) {
    const ar = ARGENTINA_VOICES.find(
      (v) => v.name.toLowerCase() === preferred || v.id === preferred || preferred.includes(v.id),
    );
    if (ar) return ar;
    const exact = list.find((v) => String(v?.name || "").toLowerCase() === preferred && isLatamSpanishVoice(v));
    if (exact) return exact;
  }
  const installedAr = list.find((v) => String(v?.lang || "").toLowerCase().startsWith("es-ar"));
  if (installedAr) return installedAr;
  if (!preferred) return ARGENTINA_VOICES[0];

  let best = null;
  let bestScore = 0;
  for (const v of list) {
    if (isSpainSpanishVoice(v)) continue;
    const lang = String(v?.lang || "").toLowerCase();
    const name = String(v?.name || "");
    if (!lang.startsWith("es")) continue;
    let score = 40;
    for (const [prefix, pts] of LANG_SCORE) {
      if (lang.startsWith(prefix)) {
        score = pts;
        break;
      }
    }
    if (MALE_LATAM.test(name)) score += 25;
    if (FEMALE_LATAM.test(name)) score += 8;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : ARGENTINA_VOICES[0];
}

export function splitTtsChunks(text, maxLen = 280) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return [];
  if (raw.length <= maxLen) return [raw];
  const sentences = raw.split(/(?<=[.!?…])\s+/);
  const chunks = [];
  let buf = "";
  const pushHard = (s) => {
    for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen));
  };
  for (const s of sentences) {
    if (!s) continue;
    const next = buf ? `${buf} ${s}` : s;
    if (next.length <= maxLen) {
      buf = next;
    } else {
      if (buf) chunks.push(buf);
      if (s.length <= maxLen) buf = s;
      else {
        pushHard(s);
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

let resumeTimer = null;
let speakGeneration = 0;

function stopResumeWatchdog() {
  if (resumeTimer) {
    clearInterval(resumeTimer);
    resumeTimer = null;
  }
}

function startResumeWatchdog(synth) {
  stopResumeWatchdog();
  if (!synth) return;
  resumeTimer = setInterval(() => {
    try {
      if (synth.speaking && synth.paused) synth.resume();
    } catch {
      /* ignore */
    }
  }, 8000);
}

export function cancelAppleTts() {
  speakGeneration += 1;
  stopResumeWatchdog();
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

async function speakViaLocalArgentinaApi(text, voiceName) {
  const apiBase = getCalcApiBase();
  const resp = await fetch(`${apiBase}/api/agent/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: argentinaVoiceId(voiceName) }),
  });
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 409 || data.needs_download) {
    const err = new Error(data.error || "needs_download");
    err.needs_download = true;
    throw err;
  }
  if (!resp.ok || !data.ok) {
    throw new Error(data.error || `speak HTTP ${resp.status}`);
  }
}

function speakViaBrowser(text, opts, gen) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  const synth = window.speechSynthesis;
  const rate = Number(opts.rate);
  const speakRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const chunks = splitTtsChunks(text);
  if (chunks.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      if (gen === speakGeneration) stopResumeWatchdog();
      resolve();
    };
    const runWithVoices = (voices) => {
      if (gen !== speakGeneration) {
        finish();
        return;
      }
      const preferred = opts.voiceName || loadAppleTtsVoiceName();
      const picked = pickAppleSpanishVoice(voices, { preferredName: preferred });
      const browserMatch = voices.find(
        (v) =>
          String(v?.lang || "").toLowerCase().startsWith("es-ar") ||
          String(v?.name || "").toLowerCase() === String(picked?.name || "").toLowerCase(),
      );
      let i = 0;
      const speakNext = () => {
        if (gen !== speakGeneration) {
          finish();
          return;
        }
        if (i >= chunks.length) {
          finish();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[i]);
        i += 1;
        utterance.lang = browserMatch?.lang || "es-AR";
        if (browserMatch) utterance.voice = browserMatch;
        utterance.rate = speakRate;
        utterance.onend = speakNext;
        utterance.onerror = () => speakNext();
        try {
          synth.speak(utterance);
        } catch {
          speakNext();
        }
      };
      startResumeWatchdog(synth);
      speakNext();
    };
    const existing = synth.getVoices();
    if (existing.length > 0) {
      runWithVoices(existing);
      return;
    }
    const onVoices = () => {
      synth.removeEventListener("voiceschanged", onVoices);
      runWithVoices(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onVoices);
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoices);
      if (gen === speakGeneration) runWithVoices(synth.getVoices());
    }, 400);
  });
}

/**
 * Speak with Diego (Argentina) via local Apple TTS when possible.
 * @param {string} text
 * @param {{ rate?: number, voiceName?: string, onNeedsDownload?: (msg: string) => void }} [opts]
 */
export async function speakApple(text, opts = {}) {
  if (!text) return;
  cancelAppleTts();
  const gen = speakGeneration;
  const preferred = opts.voiceName || loadAppleTtsVoiceName();
  const wantAr = isArgentinaVoiceName(preferred) || !preferred;

  if (wantAr && typeof fetch === "function") {
    try {
      await speakViaLocalArgentinaApi(text, preferred);
      return;
    } catch (err) {
      if (err?.needs_download) opts.onNeedsDownload?.(err.message);
      // fall through to browser
    }
  }
  if (gen !== speakGeneration) return;
  await speakViaBrowser(text, { ...opts, voiceName: preferred }, gen);
}

export async function requestArgentinaVoiceInstall() {
  const apiBase = getCalcApiBase();
  const resp = await fetch(`${apiBase}/api/agent/speak/install`, { method: "POST" });
  return resp.json().catch(() => ({ ok: false }));
}

export async function fetchArgentinaVoiceStatus() {
  const apiBase = getCalcApiBase();
  const resp = await fetch(`${apiBase}/api/agent/speak/status`);
  return resp.json().catch(() => ({ ok: false, argentina_installed: false }));
}
