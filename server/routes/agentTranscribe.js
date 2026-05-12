/**
 * POST /api/agent/transcribe — one-shot speech-to-text via OpenAI Whisper.
 *
 * Used by the chat input mic button (useDictation hook). Public route
 * (matches the chat endpoint's open-to-operators threat model), but
 * rate-limited at 20/min/IP to bound abuse cost ($0.006/min for whisper-1).
 *
 * Request:  raw audio buffer (audio/webm, audio/ogg, audio/mp4, audio/mpeg,
 *           audio/wav). Optional ?language=es (default es).
 * Response: { ok: true, text: string, language: string, duration_ms: number|null }
 *           or { ok: false, error: string } on validation/upstream failure.
 *
 * Why no requireAuth: an operator using the chat in non-dev mode still
 * needs dictation. Same threat model as /api/agent/chat — public path
 * gated by rate limit and body-size limit.
 */
import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";

const router = Router();

const transcribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiadas transcripciones. Esperá un momento." },
});

const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "application/octet-stream", // some browsers omit Content-Type
]);

router.post(
  "/agent/transcribe",
  transcribeLimiter,
  express.raw({
    type: (req) => {
      const ct = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      return ct.startsWith("audio/") || ct === "application/octet-stream";
    },
    limit: "10mb",
  }),
  async (req, res) => {
    if (!config.openaiApiKey) {
      return res.status(503).json({ ok: false, error: "OPENAI_API_KEY no configurado en el server" });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ ok: false, error: "Audio body requerido (raw binary, audio/* MIME)" });
    }
    if (req.body.length < 1024) {
      // Whisper rejects extremely short clips with a generic error; surface a friendlier one
      return res.status(400).json({ ok: false, error: "Audio demasiado corto (mínimo ~1s)" });
    }

    const ct = String(req.headers["content-type"] || "audio/webm").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIMES.has(ct)) {
      return res.status(415).json({ ok: false, error: `Content-Type no soportado: ${ct}` });
    }

    const language = String(req.query?.language || "es").slice(0, 5).toLowerCase();
    if (!/^[a-z]{2,5}$/.test(language)) {
      return res.status(400).json({ ok: false, error: "language inválido (ISO-639-1 esperado)" });
    }

    try {
      // FormData + Blob are global in Node 20+. Whisper expects multipart/form-data.
      const formData = new FormData();
      const ext = ct === "audio/mpeg" ? "mp3" : ct.split("/")[1].replace(/^x-/, "");
      const blob = new Blob([req.body], { type: ct });
      formData.append("file", blob, `audio.${ext}`);
      formData.append("model", "whisper-1");
      formData.append("language", language);
      formData.append("response_format", "verbose_json"); // includes duration

      const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.openaiApiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        req.log?.warn({ status: resp.status, body: errText.slice(0, 500) }, "Whisper API error");
        return res.status(resp.status === 401 ? 503 : 502).json({
          ok: false,
          error: `Whisper API ${resp.status}`,
        });
      }

      const data = await resp.json();
      return res.json({
        ok: true,
        text: String(data.text || "").trim(),
        language,
        duration_ms: typeof data.duration === "number" ? Math.round(data.duration * 1000) : null,
      });
    } catch (err) {
      req.log?.error({ err: err.message }, "transcribe failed");
      return res.status(500).json({ ok: false, error: err.message || "Transcribe failed" });
    }
  }
);

export default router;
