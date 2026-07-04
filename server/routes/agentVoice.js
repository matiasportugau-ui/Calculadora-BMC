/**
 * POST /api/agent/voice/session  — mint an ephemeral OpenAI Realtime token
 * POST /api/agent/voice/action   — validate + relay a function-call action from voice mode
 *
 * The browser uses the ephemeral client_secret to open a WebRTC peer connection
 * directly to OpenAI Realtime; the long-lived key is never sent to the client.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { buildVoiceSystemPrompt } from "../lib/chatPrompts.js";
import { clientIpKey } from "../lib/rateLimitKeys.js";

import { recordVoiceError, listVoiceErrors, clearVoiceErrors } from "../lib/voiceErrorLog.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";

const router = Router();

const REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

const VALID_ACTION_TYPES = new Set([
  "setScenario", "setLP", "setTecho", "setPared", "setCamara",
  "setFlete", "setProyecto", "setWizardStep", "setTechoZonas", "advanceWizard", "buildQuote",
]);

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.appEnv === "development" ? 30 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  skip: () => config.appEnv === "development",
  message: { ok: false, error: "Demasiadas sesiones de voz. Esperá un momento." },
});

// Action relay: same key generator but more generous limit
const actionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: { ok: false, error: "Demasiadas acciones de voz. Esperá un momento." },
});

/**
 * POST /api/agent/voice/session
 *
 * Body: { calcState?: object, devMode?: boolean }
 * Returns: { session_id, client_secret, model, expires_at }
 *
 * Requires OPENAI_API_KEY. Auth: the static API_AUTH_TOKEN (operators/dev/CI) OR a
 * logged-in user's identity JWT with calc:write (every comprador has this by default).
 */
router.post(
  "/agent/voice/session",
  sessionLimiter,
  requireServiceOrUser({ module: "calc", minLevel: "write" }),
  async (req, res) => {
  if (!config.openaiApiKey) {
    return res.status(503).json({ ok: false, error: "OpenAI API key not configured" });
  }

  const { calcState = {}, devMode = false, leadContext = null } = req.body || {};

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
    const response = await fetch(REALTIME_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: config.openaiRealtimeModel,
          instructions: systemPrompt,
          audio: {
            input: {
              transcription: { model: "whisper-1" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 800,
              },
            },
            output: { voice: "shimmer" },
          },
          tools,
          tool_choice: "auto",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      req.log?.warn({ status: response.status, body: errText }, "OpenAI Realtime session mint failed");
      let detail = "";
      try { detail = JSON.parse(errText)?.error?.message || errText; } catch { detail = errText; }
      // Best-effort redaction of any reflected system prompt before persisting.
      // Note: the regex doesn't handle escaped quotes (\") inside the value — this is a
      // defensive measure for the common case (OpenAI rarely reflects values verbatim).
      const safeDetail = (detail || errText || "")
        .replace(/"instructions"\s*:\s*"[^"]*"/g, '"instructions":"[redacted]"');
      recordVoiceError({
        kind: "session_mint",
        status: response.status,
        message: `OpenAI ${response.status}`,
        detail: safeDetail || null,
      });
      return res.status(502).json({
        ok: false,
        error: `OpenAI ${response.status}: ${detail || "No se pudo iniciar sesión de voz"}`,
      });
    }

    const mintData = await response.json();
    sessionData = {
      id: mintData.session?.id,
      model: mintData.session?.model || config.openaiRealtimeModel,
      client_secret: {
        value: mintData.value,
        expires_at: mintData.expires_at,
      },
    };
  } catch (err) {
    req.log?.error({ err }, "Voice session fetch error");
    recordVoiceError({
      kind: "session_mint_network",
      message: "Error de red al iniciar sesión de voz",
      detail: err?.message || null,
    });
    return res.status(502).json({ ok: false, error: "Error de red al iniciar sesión de voz" });
  }

  return res.json({
    ok: true,
    session_id: sessionData.id,
    client_secret: sessionData.client_secret,
    model: sessionData.model || config.openaiRealtimeModel,
    expires_at: sessionData.client_secret?.expires_at,
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
router.post("/agent/voice/action", actionLimiter, async (req, res) => {
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
  keyGenerator: clientIpKey,
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
 * Pings OpenAI /v1/models with the configured key to confirm it is still active.
 * Returns metadata (prefix, suffix, length) but never the full key. Admin-only.
 */
router.get("/agent/voice/health", requireAuth, async (req, res) => {
  const key = config.openaiApiKey || "";
  const meta = {
    configured: Boolean(key),
    keyLength: key.length,
    keyPrefix: key.slice(0, 8),
    keySuffix: key ? key.slice(-4) : "",
    model: config.openaiRealtimeModel,
  };
  if (!key) {
    return res.status(503).json({ ok: false, ...meta, error: "OPENAI_API_KEY not configured" });
  }

  const t0 = Date.now();
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - t0;
    if (r.ok) {
      return res.json({ ok: true, status: r.status, latencyMs, ...meta });
    }
    let detail = "";
    try { detail = (await r.json())?.error?.message || ""; } catch { /* ignore */ }
    return res.status(502).json({
      ok: false,
      status: r.status,
      latencyMs,
      ...meta,
      error: detail || `OpenAI ${r.status}`,
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      latencyMs: Date.now() - t0,
      ...meta,
      error: err?.message || "network error",
    });
  }
});

export default router;
