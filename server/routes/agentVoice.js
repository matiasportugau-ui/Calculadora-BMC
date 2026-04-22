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
import { buildSystemPrompt } from "../lib/chatPrompts.js";
import { findRelevantExamples } from "../lib/trainingKB.js";

const router = Router();

const REALTIME_SESSIONS_URL = "https://api.openai.com/v1/realtime/sessions";

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
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: voiceSessionKey,
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

function isDevAuthorized(req) {
  if (!config.apiAuthToken) return { ok: false, status: 503, error: "API_AUTH_TOKEN not configured" };
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
  if (bearer === config.apiAuthToken || xKey === config.apiAuthToken) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

/**
 * POST /api/agent/voice/session
 *
 * Body: { calcState?: object, devMode?: boolean }
 * Returns: { session_id, client_secret, model, expires_at }
 *
 * Requires OPENAI_API_KEY. devMode requires dev auth header.
 */
router.post("/agent/voice/session", sessionLimiter, async (req, res) => {
  if (!config.openaiApiKey) {
    return res.status(503).json({ ok: false, error: "OpenAI API key not configured" });
  }

  const { calcState = {}, devMode = false } = req.body || {};

  if (devMode) {
    const auth = isDevAuthorized(req);
    if (!auth.ok) {
      return res.status(auth.status || 401).json({ ok: false, error: auth.error });
    }
  }

  let trainingExamples = [];
  try {
    trainingExamples = await findRelevantExamples("", 3);
  } catch {
    // Non-fatal
  }

  const systemPrompt = buildSystemPrompt(calcState, { trainingExamples, devMode });

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
    const response = await fetch(REALTIME_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiRealtimeModel,
        voice: "shimmer",
        instructions: systemPrompt,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
        },
        tools,
        tool_choice: "auto",
        modalities: ["text", "audio"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      req.log?.warn({ status: response.status, body: errText }, "OpenAI Realtime session mint failed");
      return res.status(502).json({ ok: false, error: "No se pudo iniciar sesión de voz" });
    }

    sessionData = await response.json();
  } catch (err) {
    req.log?.error({ err }, "Voice session fetch error");
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

export default router;
