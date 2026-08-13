/**
 * Local macOS TTS for Español (Argentina) — Diego / Isabela.
 * Uses scripts/bin/apple-tts.swift (AVSpeech). Exit 12 = voice not installed.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../..");
const SWIFT_SRC = join(REPO_ROOT, "scripts/bin/apple-tts.swift");

function envOff(env = process.env) {
  const v = String(env.BMC_APPLE_TTS ?? "1").toLowerCase();
  return v === "0" || v === "false" || v === "off";
}

export function findAppleTtsBinary(opts = {}) {
  const env = opts.env || process.env;
  const exists = opts.exists || existsSync;
  const platform = opts.platform || process.platform;
  if (platform !== "darwin") return null;
  if (envOff(env)) return null;
  const explicit = env.BMC_APPLE_TTS_BIN;
  if (explicit && exists(explicit)) return explicit;
  const home = opts.homedir || homedir();
  const candidates = [
    join(home, ".ialfred/bin/apple-tts"),
    join(REPO_ROOT, "scripts/bin/apple-tts"),
  ];
  for (const p of candidates) {
    if (exists(p)) return p;
  }
  return null;
}

export function ensureAppleTtsBinary(opts = {}) {
  const existing = findAppleTtsBinary(opts);
  if (existing) return existing;
  const env = opts.env || process.env;
  const exists = opts.exists || existsSync;
  const platform = opts.platform || process.platform;
  if (platform !== "darwin" || envOff(env)) return null;
  const src = opts.swiftSrc || SWIFT_SRC;
  if (!exists(src)) return null;
  const dest = join(opts.homedir || homedir(), ".ialfred/bin/apple-tts");
  try {
    mkdirSync(dirname(dest), { recursive: true });
  } catch {
    /* ignore */
  }
  const r = spawnSync("swiftc", ["-O", src, "-o", dest], { encoding: "utf8", timeout: 120_000 });
  if (r.status === 0 && exists(dest)) return dest;
  return null;
}

export function normalizeArgentinaVoice(voice) {
  const s = String(voice || "diego").toLowerCase();
  if (s.includes("isabela") || s.includes("isabel")) return "isabela";
  return "diego";
}

export function isArgentinaVoiceName(name) {
  const s = String(name || "").toLowerCase();
  return (
    s.includes("diego") ||
    s.includes("isabela") ||
    s.includes("argent") ||
    s === "es-ar" ||
    s.startsWith("es-ar")
  );
}

export const ARGENTINA_PICKER_VOICES = [
  { name: "Diego (Argentina)", lang: "es-AR", id: "diego", gender: "male" },
  { name: "Isabela (Argentina)", lang: "es-AR", id: "isabela", gender: "female" },
];

function runBin(bin, args, timeoutMs = 60_000, onChild) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      resolve({ code: 127, stdout: "", stderr: err?.message || "spawn failed" });
      return;
    }
    onChild?.(child);
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      stdout += d;
    });
    child.stderr?.on("data", (d) => {
      stderr += d;
    });
    child.on("error", (err) => {
      clearTimeout(t);
      resolve({ code: 127, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function probeArgentinaTts(opts = {}) {
  const bin = opts.binary || ensureAppleTtsBinary(opts);
  if (!bin) {
    return { ok: false, argentina_installed: false, error: "apple-tts no compilado" };
  }
  const r = await runBin(bin, ["--probe"], 15_000);
  try {
    const json = JSON.parse(r.stdout || "{}");
    return {
      ok: true,
      argentina_installed: !!json.argentina_installed,
      diego_lang: json.diego_lang || null,
      voices: json.voices || [],
    };
  } catch {
    return {
      ok: false,
      argentina_installed: false,
      error: (r.stderr || r.stdout || "probe failed").trim().slice(0, 300),
    };
  }
}

// ── in-flight speak tracking ────────────────────────────────────────────────
// Radio UX is one voice at a time: a new /speak kills the previous child, and
// the route kills it when the request is aborted (grok-review deaf816d bug 2 —
// before this, cancel only stopped browser TTS; apple-tts kept talking).
let activeSpeakChild = null;

export function registerActiveSpeakChild(child) {
  activeSpeakChild = child || null;
  if (child) {
    child.on?.("close", () => {
      if (activeSpeakChild === child) activeSpeakChild = null;
    });
  }
}

/** Kill the in-flight apple-tts child, if any. Returns true if one was killed. */
export function killActiveSpeak() {
  const child = activeSpeakChild;
  activeSpeakChild = null;
  if (!child) return false;
  try {
    child.kill("SIGKILL");
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak via AVSpeech (speakers) — used when we do not need a file.
 * @returns {Promise<{ ok: true, voice: string } | { ok: false, needs_download?: boolean, error: string, status: number }>}
 */
export async function speakArgentina(text, opts = {}) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, error: "texto vacío", status: 400 };
  if (raw.length > 8000) return { ok: false, error: "texto demasiado largo", status: 400 };
  const bin = opts.binary || ensureAppleTtsBinary(opts);
  if (!bin) return { ok: false, error: "apple-tts no disponible", status: 503 };
  const voice = normalizeArgentinaVoice(opts.voice);
  killActiveSpeak();
  const r = await runBin(
    bin,
    ["--voice", voice, raw],
    Number(opts.timeoutMs || 90_000),
    registerActiveSpeakChild,
  );
  if (r.code === 0) return { ok: true, voice, engine: "apple-tts" };
  if (r.code === 12 || /needs_download/i.test(r.stderr || "")) {
    return {
      ok: false,
      needs_download: true,
      status: 409,
      error:
        "Falta la voz Español (Argentina). Ajustes → Accesibilidad → Contenido leído → Voces del sistema → Español (Argentina) → Diego.",
    };
  }
  return {
    ok: false,
    error: (r.stderr || r.stdout || `apple-tts exit ${r.code}`).trim().slice(0, 400),
    status: 502,
  };
}

export const SPOKEN_CONTENT_SETTINGS =
  "x-apple.systempreferences:com.apple.Accessibility-Settings.extension?SpokenContent";

export function openSpokenContentSettings() {
  if (process.platform !== "darwin") return { ok: false, error: "solo macOS" };
  const r = spawnSync("open", [SPOKEN_CONTENT_SETTINGS], { encoding: "utf8" });
  if (r.status === 0) return { ok: true };
  return { ok: false, error: (r.stderr || "open failed").trim() };
}
