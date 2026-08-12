/**
 * POST /api/agent/voice/session  — mint ephemeral Realtime token (OpenAI or Grok/xAI)
 * POST /api/agent/voice/action   — validate + relay a function-call action from voice mode
 *
 * The browser uses the ephemeral client_secret to open a WebRTC peer connection
 * directly to OpenAI Realtime or xAI Grok Voice; long-lived keys never leave the server.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { buildVoiceSystemPrompt } from "../lib/chatPrompts.js";

import { recordVoiceError, listVoiceErrors, clearVoiceErrors } from "../lib/voiceErrorLog.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import {
  resolveVoiceProvider,
  resolveSessionModel,
  mintRealtimeClientSecret,
  markVoiceProviderDead,
  isVoiceMintFallbackError,
  getVoiceProviderConfig,
} from "../lib/voiceRealtimeProviders.js";

const router = Router();

const VALID_ACTION_TYPES = new Set([
  "setScenario", "setLP", "setTecho", "setPared", "setCamara",
  "setFlete", "setProyecto", "setWizardStep", "setTechoZonas", "advanceWizard", "buildQuote",
]);

// 3 session mints per minute per IP (ephemeral tokens cost ~1 API call each)
function voiceSessionKey(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.appEnv === "development" ? 30 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: voiceSessionKey,
  skip: () => config.appEnv === "development",
  message: { ok: false, error: "Demasiadas sesiones de voz. Esperá un momento." },
});

// Action relay: same key generator but more generous limit
const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: voiceSessionKey,
  message: { ok: false, error: "Demasiadas acciones de voz. Esperá un momento." },
});

/**
 * POST /api/agent/voice/session
 *
 * Body: {
 *   calcState?, devMode?, leadContext?,
 *   realtimeModel?, aiProvider?, aiModel?, voiceProvider? ("openai"|"grok")
 * }
 * Returns: {
 *   session_id, client_secret, model, expires_at,
 *   provider, voice_provider, realtime_base,
 *   session_bootstrap?  // Grok: apply via data-channel session.update
 * }
 *
 * OpenAI: OPENAI_API_KEY. Grok: GROK_API_KEY / XAI_API_KEY.
 * Auth: API_AUTH_TOKEN OR identity JWT with calc:write.
 */
router.post(
  "/agent/voice/session",
  sessionLimiter,
  requireServiceOrUser({ module: "calc", minLevel: "write" }),
  async (req, res) => {
  const {
    calcState = {},
    devMode = false,
    leadContext = null,
    realtimeModel: rawRealtimeModel = null,
    aiProvider = "auto",
    aiModel = "",
    voiceProvider: rawVoiceProvider = null,
  } = req.body || {};

  let voiceProvider = resolveVoiceProvider(aiProvider, rawVoiceProvider);

  let sessionModel;
  try {
    sessionModel = resolveSessionModel(
      voiceProvider,
      aiProvider,
      aiModel,
      rawRealtimeModel,
    );
  } catch (err) {
    if (err?.status === 400) {
      return res.status(400).json({
        ok: false,
        error: err.message,
        allowlist: err.allowlist || undefined,
      });
    }
    throw err;
  }

  req.log?.info?.(
    {
      event: "panelin_voice_session",
      voiceProvider,
      realtimeModel: sessionModel,
      aiProvider,
      aiModel: aiModel || null,
    },
    "voice session model resolved",
  );

  // Whitelist the lead-context fields we accept from the client (launched from
  // the CRM sheet hyperlink). sanitizeForPrompt inside buildVoiceSystemPrompt
  // handles length-capping + injection neutralization of the values themselves.
  const safeLeadContext =
    leadContext && typeof leadContext === "object"
      ? {
          quoteId: leadContext.quoteId,
          cliente: leadContext.cliente,
          consulta: leadContext.consulta,
        }
      : null;

  const systemPrompt = buildVoiceSystemPrompt(calcState, { devMode, leadContext: safeLeadContext });

  // Tool definitions mirroring the text-mode action set
  const tools = [
    {
      type: "function",
      name: "setScenario",
      description: "Establece el escenario de la calculadora",
      parameters: { type: "object", properties: { scenario: { type: "string" } }, required: ["scenario"] },
    },
    {
      type: "function",
      name: "setLP",
      description: "Establece la lista de precios (web o venta)",
      parameters: { type: "object", properties: { listaPrecios: { type: "string" } }, required: ["listaPrecios"] },
    },
    {
      type: "function",
      name: "setTecho",
      description: "Configura los parámetros del techo",
      parameters: {
        type: "object",
        properties: {
          familia: { type: "string" },
          espesor: { type: "string" },
          color: { type: "string" },
          tipoAguas: { type: "string" },
          pendiente: { type: "number" },
          tipoEst: { type: "string" },
          zonas: { type: "array", items: { type: "object" } },
        },
      },
    },
    {
      type: "function",
      name: "setPared",
      description: "Configura los parámetros de la pared/fachada",
      parameters: {
        type: "object",
        properties: {
          familia: { type: "string" },
          espesor: { type: "string" },
          alto: { type: "number" },
          perimetro: { type: "number" },
        },
      },
    },
    {
      type: "function",
      name: "setCamara",
      description: "Configura las dimensiones de la cámara frigorífica",
      parameters: {
        type: "object",
        properties: {
          largo_int: { type: "number" },
          ancho_int: { type: "number" },
          alto_int: { type: "number" },
        },
        required: ["largo_int", "ancho_int", "alto_int"],
      },
    },
    {
      type: "function",
      name: "setFlete",
      description: "Establece el costo de flete en USD",
      parameters: { type: "object", properties: { flete: { type: "number" } }, required: ["flete"] },
    },
    {
      type: "function",
      name: "setProyecto",
      description: "Establece datos del proyecto (nombre, RUT, etc.)",
      parameters: { type: "object", properties: { nombre: { type: "string" }, rut: { type: "string" } } },
    },
  ];

  let sessionData;
  try {
    try {
      sessionData = await mintRealtimeClientSecret({
        voiceProvider,
        sessionModel,
        systemPrompt,
        tools,
      });
    } catch (mintErr) {
      // Auto-fallback a Grok Voice cuando OpenAI no responde (cuota/auth/5xx/
      // timeout de egress) y el usuario no eligió engine explícitamente.
      // Visto 2026-08-10: api.openai.com inalcanzable desde Cloud Run.
      const canFallback =
        voiceProvider === "openai" &&
        !rawVoiceProvider &&
        isVoiceMintFallbackError(mintErr) &&
        getVoiceProviderConfig("grok").keyOk;
      if (!canFallback) throw mintErr;

      markVoiceProviderDead("openai");
      req.log?.warn?.(
        { status: mintErr?.status || 0, detail: mintErr?.message },
        "OpenAI voice mint failed — falling back to Grok Voice",
      );
      recordVoiceError({
        kind: "session_mint_fallback",
        status: mintErr?.status || 0,
        message: "OpenAI mint failed — fallback a Grok Voice",
        detail: mintErr?.message || null,
      });
      voiceProvider = "grok";
      sessionModel = resolveSessionModel("grok", aiProvider, aiModel, null);
      sessionData = await mintRealtimeClientSecret({
        voiceProvider,
        sessionModel,
        systemPrompt,
        tools,
      });
    }
  } catch (err) {
    if (err?.status === 503) {
      return res.status(503).json({ ok: false, error: err.message });
    }
    if (err?.status && err.status >= 400 && err.status < 600 && err.body != null) {
      const errText = String(err.body || "");
      req.log?.warn(
        { status: err.status, body: errText, voiceProvider },
        "Realtime session mint failed",
      );
      let detail = "";
      try {
        detail = JSON.parse(errText)?.error?.message || errText;
      } catch {
        detail = errText;
      }
      const safeDetail = (detail || errText || "")
        .replace(/"instructions"\s*:\s*"[^"]*"/g, '"instructions":"[redacted]"');
      const label = voiceProvider === "grok" ? "Grok" : "OpenAI";
      recordVoiceError({
        kind: "session_mint",
        status: err.status,
        message: `${label} ${err.status}`,
        detail: safeDetail || null,
      });
      return res.status(502).json({
        ok: false,
        error: `${label} ${err.status}: ${detail || "No se pudo iniciar sesión de voz"}`,
        provider: voiceProvider,
      });
    }
    req.log?.error({ err, voiceProvider }, "Voice session fetch error");
    recordVoiceError({
      kind: "session_mint_network",
      message: "Error de red al iniciar sesión de voz",
      detail: err?.message || null,
    });
    return res.status(502).json({ ok: false, error: "Error de red al iniciar sesión de voz" });
  }

  // Grok client_secrets does not embed session config — client must session.update after connect.
  const session_bootstrap =
    voiceProvider === "grok"
      ? {
          instructions: systemPrompt,
          tools,
          tool_choice: "auto",
        }
      : null;

  return res.json({
    ok: true,
    session_id: sessionData.id,
    client_secret: sessionData.client_secret,
    model: sessionData.model || sessionModel,
    expires_at: sessionData.client_secret?.expires_at,
    provider: sessionData.voiceProvider,
    voice_provider: sessionData.voiceProvider,
    realtime_base: sessionData.realtime_base,
    session_bootstrap,
  });
});

/**
 * POST /api/agent/voice/action
 *
 * Body: { action: { type, payload }, conversationId?: string }
 * Returns: { ok, action } — the validated (possibly enriched) action.
 *
 * The browser receives the validated action, applies it via the existing
 * handleChatAction pipeline, then sends the result back to OpenAI via
 * the WebRTC data channel to let the voice agent continue.
 */
router.post(
  "/agent/voice/action",
  actionLimiter,
  // Same auth as session mint — buildQuote preview mutates pricing helpers;
  // never leave this public (Bug DT).
  requireServiceOrUser({ module: "calc", minLevel: "write" }),
  async (req, res) => {
  const { action } = req.body || {};

  if (!action || typeof action !== "object") {
    return res.status(400).json({ ok: false, error: "action object required" });
  }

  const { type, payload } = action;

  if (!type || !VALID_ACTION_TYPES.has(type)) {
    return res.status(400).json({ ok: false, error: `Unknown action type: ${type}` });
  }

  // Mirror the buildQuote server-side preview logic from agentChat if available
  if (type === "buildQuote") {
    let validateAndPreviewQuote;
    try {
      // Dynamic import so the route works even if quotePayloadValidator isn't deployed yet
      const mod = await import("../lib/quotePayloadValidator.js").catch(() => null);
      validateAndPreviewQuote = mod?.validateAndPreviewQuote;
    } catch {
      validateAndPreviewQuote = null;
    }

    if (validateAndPreviewQuote) {
      const validation = validateAndPreviewQuote(payload);
      if (!validation.valid) {
        return res.json({ ok: false, rejected: true, errors: validation.errors });
      }
      return res.json({
        ok: true,
        action: { ...action, preview: validation.preview, warnings: validation.preview.warnings },
      });
    }
  }

  return res.json({ ok: true, action });
});

/**
 * GET /api/agent/voice/errors
 * Returns the in-memory ring buffer of voice mode errors (newest first, max 50).
 * Admin-only — voice errors may include OpenAI detail strings.
 */
router.get("/agent/voice/errors", requireAuth, (req, res) => {
  return res.json({ ok: true, errors: listVoiceErrors() });
});

const errorClearLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: voiceSessionKey,
  message: { ok: false, error: "Demasiados clears. Esperá un momento." },
});

/**
 * POST /api/agent/voice/errors/clear  — wipe the ring buffer.
 */
router.post("/agent/voice/errors/clear", errorClearLimiter, requireAuth, (req, res) => {
  clearVoiceErrors();
  return res.json({ ok: true });
});

/**
 * GET /api/agent/voice/health
 * Resuelve el engine de voz activo (auto: openai con fallback a grok, o pin
 * VOICE_PROVIDER) y pinguea su /v1/models para confirmar que la key sirve.
 * Returns metadata (prefix, suffix, length) but never the full key. Admin-only.
 */
router.get("/agent/voice/health", requireAuth, async (req, res) => {
  const voiceProvider = resolveVoiceProvider("auto");
  const cfg = getVoiceProviderConfig(voiceProvider);
  const key = cfg.keyOk ? cfg.apiKey : "";
  const meta = {
    voiceProvider,
    configured: cfg.keyOk,
    keyLength: key.length,
    keyPrefix: key.slice(0, 8),
    keySuffix: key ? key.slice(-4) : "",
    model: resolveSessionModel(voiceProvider, "auto", "", null),
  };
  if (!cfg.keyOk) {
    return res.status(503).json({ ok: false, ...meta, error: cfg.missingKeyError });
  }

  const t0 = Date.now();
  try {
    const r = await fetch(cfg.modelsUrl, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - t0;
    if (r.ok) {
      return res.json({ ok: true, status: r.status, latencyMs, ...meta });
    }
    let detail = "";
    try { detail = (await r.json())?.error?.message || ""; } catch { /* ignore */ }
    // Acelera el self-heal: el próximo resolveVoiceProvider("auto") evita este engine.
    markVoiceProviderDead(voiceProvider);
    return res.status(502).json({
      ok: false,
      status: r.status,
      latencyMs,
      ...meta,
      error: detail || `${voiceProvider} ${r.status}`,
    });
  } catch (err) {
    markVoiceProviderDead(voiceProvider);
    return res.status(502).json({
      ok: false,
      latencyMs: Date.now() - t0,
      ...meta,
      error: err?.message || "network error",
    });
  }
});

export default router;
