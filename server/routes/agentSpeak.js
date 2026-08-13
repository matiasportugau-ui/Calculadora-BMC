/**
 * Local Apple TTS for Radio — Español (Argentina) Diego / Isabela.
 *
 * POST /api/agent/speak  { text, voice? }  → { ok } after speaking on this Mac
 * GET  /api/agent/speak/status             → { argentina_installed, ... }
 * POST /api/agent/speak/install            → opens System Settings Spoken Content
 */
import { Router } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  probeArgentinaTts,
  speakArgentina,
  openSpokenContentSettings,
  ARGENTINA_PICKER_VOICES,
} from "../lib/appleTtsSpeak.js";

const router = Router();

const speakLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Demasiadas lecturas de voz. Esperá un momento." },
});

router.get("/agent/speak/status", async (_req, res) => {
  const probe = await probeArgentinaTts();
  return res.json({
    ok: true,
    argentina_installed: !!probe.argentina_installed,
    diego_lang: probe.diego_lang || null,
    picker: ARGENTINA_PICKER_VOICES,
    error: probe.error || null,
  });
});

router.post("/agent/speak/install", (_req, res) => {
  const r = openSpokenContentSettings();
  if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
  return res.json({
    ok: true,
    hint: "En Ajustes → Accesibilidad → Contenido leído → Voces del sistema, descargá Español (Argentina) → Diego.",
  });
});

router.post("/agent/speak", speakLimiter, express.json({ limit: "32kb" }), async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const voice = req.body?.voice || "diego";
  const out = await speakArgentina(text, { voice });
  if (out.ok) return res.json({ ok: true, voice: out.voice, engine: out.engine });
  return res.status(out.status || 500).json({
    ok: false,
    error: out.error,
    needs_download: !!out.needs_download,
  });
});

export default router;
