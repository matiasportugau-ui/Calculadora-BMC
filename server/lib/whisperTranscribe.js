/**
 * Shared OpenAI Whisper speech-to-text helper.
 * Used by POST /api/agent/transcribe and WA transcript worker.
 */
import { config } from "../config.js";
import { isUsableApiKey } from "./apiKeyUtils.js";

/**
 * @param {Buffer} buffer
 * @param {{ language?: string, mime?: string, filename?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: true, text: string, language: string, duration_ms: number|null } | { ok: false, error: string, status?: number }>}
 */
export async function whisperTranscribeBuffer(buffer, opts = {}) {
  if (!isUsableApiKey(config.openaiApiKey)) {
    return { ok: false, error: "OPENAI_API_KEY not configured", status: 503 };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: "empty audio buffer", status: 400 };
  }
  if (buffer.length < 1024) {
    return { ok: false, error: "audio too short", status: 400 };
  }

  const language = String(opts.language || "es").slice(0, 5).toLowerCase();
  const mime = String(opts.mime || "audio/ogg").split(";")[0].trim().toLowerCase();
  const ext =
    mime.includes("mpeg") || mime.includes("mp3")
      ? "mp3"
      : mime.includes("wav")
        ? "wav"
        : mime.includes("mp4") || mime.includes("m4a")
          ? "m4a"
          : mime.includes("webm")
            ? "webm"
            : "ogg";
  const filename = opts.filename || `audio.${ext}`;
  const timeoutMs = Number(opts.timeoutMs || 60_000);

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mime.startsWith("audio/") ? mime : "audio/ogg" });
    formData.append("file", blob, filename);
    formData.append("model", "whisper-1");
    formData.append("language", language);
    formData.append("response_format", "verbose_json");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openaiApiKey}` },
      body: formData,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return {
        ok: false,
        error: `Whisper API ${resp.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
        status: resp.status,
      };
    }

    const data = await resp.json();
    return {
      ok: true,
      text: String(data.text || "").trim(),
      language,
      duration_ms: typeof data.duration === "number" ? Math.round(data.duration * 1000) : null,
    };
  } catch (err) {
    return { ok: false, error: err?.message || "transcribe failed", status: 500 };
  }
}
