/**
 * Local Apple TTS for Radio — Español (Argentina) Diego / Isabela.
 *
 * POST /api/agent/speak  { text, voice? }  → { ok } after speaking on this Mac
 * GET  /api/agent/speak/status             → { argentina_installed, ... }
 * POST /api/agent/speak/install            → opens System Settings Spoken Content
 *
 * Security (grok-review deaf816d + HANDOFF-2026-08-13-0811/0812):
 * - darwin-only: on any non-macOS host (Cloud Run) every route below is 404 —
 *   the surface does not exist in prod and nothing can ever be spawned there.
 * - auth: requireServiceOrUser({ module: "calc", minLevel: "read" }) — static
 *   API_AUTH_TOKEN (operator/CI) or a logged-in identity JWT with calc access.
 *   Anonymous browsers fall back to client-side speechSynthesis (appleTts.js).
 */
import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import {
  probeArgentinaTts,
  speakArgentina,
  killActiveSpeak,
  openSpokenContentSettings,
  ARGENTINA_PICKER_VOICES,
} from "../lib/appleTtsSpeak.js";

const router = Router();

// BMC_APPLE_TTS_PLATFORM exists only so route tests can exercise both sides
// of the guard on any OS; real deployments never set it.
function ttsPlatform() {
  return process.env.BMC_APPLE_TTS_PLATFORM || process.platform;
}

// Cheapest rejection first: no auth lookup, no DB, no spawn on non-macOS.
router.use("/agent/speak", (_req, res, next) => {
  if (ttsPlatform() !== "darwin") {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  return next();
});

const speakAuth = requireServiceOrUser({ module: "calc", minLevel: "read" });

const speakLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiadas lecturas de voz. Esperá un momento." },
});

router.get("/agent/speak/status", speakAuth, async (_req, res) => {
  const probe = await probeArgentinaTts();
  return res.json({
    ok: true,
    argentina_installed: !!probe.argentina_installed,
    diego_lang: probe.diego_lang || null,
    picker: ARGENTINA_PICKER_VOICES,
    error: probe.error || null,
  });
});

router.post("/agent/speak/install", speakAuth, (_req, res) => {
  const r = openSpokenContentSettings();
  if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
  return res.json({
    ok: true,
    hint: "En Ajustes → Accesibilidad → Contenido leído → Voces del sistema, descargá Español (Argentina) → Diego.",
  });
});

router.post("/agent/speak", speakLimiter, speakAuth, express.json({ limit: "32kb" }), async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const voice = req.body?.voice || "diego";
  // If the caller goes away (tab closed, cancel pressed → fetch aborted),
  // stop the in-flight apple-tts child instead of speaking to nobody.
  req.on("close", () => {
    if (!res.writableEnded) killActiveSpeak();
  });
  const out = await speakArgentina(text, { voice });
  if (out.ok) return res.json({ ok: true, voice: out.voice, engine: out.engine });
  return res.status(out.status || 500).json({
    ok: false,
    error: out.error,
    needs_download: !!out.needs_download,
  });
});

export default router;
