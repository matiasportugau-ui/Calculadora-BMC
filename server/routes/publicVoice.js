/**
 * Public storefront voice — shoppers on bmcuruguay.com.uy.
 *
 * POST /session  — mint Grok ephemeral token (no operator auth)
 * POST /action   — allowlisted tools only (lista web + capture_lead + handoff)
 * POST /chat     — text-to-text Panelin Front (same allowlist)
 *
 * Never mount this onto /api/agent/voice/action (operator tools).
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { executeTool } from "../lib/agentTools.js";
import { shapeToolResult } from "../mcp/voiceShape.js";
import { mintRealtimeClientSecret } from "../lib/voiceRealtimeProviders.js";
import { recordVoiceEvent } from "../lib/voiceMetrics.js";
import { recordVoiceError } from "../lib/voiceErrorLog.js";
import {
  buildStorefrontVoicePack,
  forceListaWeb,
  isPublicStorefrontTool,
  assertCaptureLead,
  buildWhatsAppHandoff,
  STOREFRONT_READ_TOOLS,
  STOREFRONT_WRITE_TOOLS,
  STOREFRONT_LEAD_ORIGEN,
  stripInternalPrices,
  isStorefrontShopTool,
} from "../lib/voice/storefrontVoicePack.js";
import { STOREFRONT_FLETE_NOTE } from "../lib/voice/storefrontAgentConfig.js";
import { runStorefrontTextTurn } from "../lib/voice/storefrontChat.js";

const SESSION_WINDOW_MS = 5 * 60 * 1000;
const SESSION_MAX = config.appEnv === "development" ? 30 : 3;
const ACTION_MAX = 120;

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function requestOrigin(req) {
  return String(req.headers.origin || "").trim();
}

export function isStorefrontOriginAllowed(origin, cfg = config) {
  if (!origin) {
    // curl / same-tab file / server health — allow only in development
    return cfg.appEnv === "development";
  }
  const allowed = cfg.storefrontVoiceOrigins || [];
  return allowed.includes(origin);
}

function originGuard(req, res, next) {
  const origin = requestOrigin(req);
  if (!isStorefrontOriginAllowed(origin, config)) {
    return res.status(403).json({ ok: false, error: "Origen no permitido." });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

function flagGuard(req, res, next) {
  if (!config.storefrontVoiceEnabled) {
    return res.status(404).json({ ok: false, error: "Voice storefront desactivado." });
  }
  next();
}

function sanitizePageUrl(raw) {
  const s = String(raw || "").trim().slice(0, 300);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.toString().slice(0, 300);
  } catch {
    return "";
  }
}

export default function createPublicVoiceRouter() {
  const router = Router();

  router.use(flagGuard);
  router.use(originGuard);

  const sessionLimiter = rateLimit({
    windowMs: SESSION_WINDOW_MS,
    max: SESSION_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    skip: () => config.appEnv === "development",
    message: { ok: false, error: "Demasiadas sesiones de voz. Esperá un momento." },
  });

  const actionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: ACTION_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    message: { ok: false, error: "Demasiadas acciones de voz. Esperá un momento." },
  });

  router.post("/session", sessionLimiter, async (req, res) => {
    const pageUrl = sanitizePageUrl(req.body?.pageUrl || req.body?.page_url);
    const pack = buildStorefrontVoicePack({ pageUrl });

    let sessionData;
    try {
      sessionData = await mintRealtimeClientSecret({
        voiceProvider: "grok",
        sessionModel: "grok-voice-latest",
        systemPrompt: pack.instructions,
        tools: pack.tools,
      });
    } catch (err) {
      if (err?.status === 503) {
        return res.status(503).json({ ok: false, error: err.message });
      }
      recordVoiceError({
        kind: "storefront_session_mint",
        status: err?.status || 0,
        message: err?.message || "mint failed",
        detail: String(err?.body || "").slice(0, 200) || null,
      });
      req.log?.warn?.({ err }, "storefront voice mint failed");
      return res.status(502).json({ ok: false, error: "No se pudo iniciar la voz. Probá de nuevo." });
    }

    recordVoiceEvent({
      kind: "storefront_session",
      surface: "storefront",
      detail: pageUrl || requestOrigin(req) || "unknown",
    });

    return res.json({
      ok: true,
      session_id: sessionData.id,
      client_secret: sessionData.client_secret,
      model: sessionData.model || "grok-voice-latest",
      expires_at: sessionData.client_secret?.expires_at,
      provider: "grok",
      voice_provider: "grok",
      realtime_base: sessionData.realtime_base,
      session_bootstrap: pack,
      max_session_ms: 8 * 60 * 1000,
    });
  });

  async function runPublicStorefrontTool(type, payload, pageUrl, log) {
    if (!isPublicStorefrontTool(type)) {
      return JSON.stringify({ ok: false, error: `Tool no permitida: ${type || "(vacío)"}` });
    }
    if (isStorefrontShopTool(type)) {
      return JSON.stringify({ ok: false, error: "Esta acción corre en el navegador de la tienda." });
    }
    if (type === "handoff_whatsapp") {
      return JSON.stringify(buildWhatsAppHandoff(payload, config.storefrontWaNumber));
    }
    if (type === "capture_lead") {
      const checked = assertCaptureLead(payload);
      if (!checked.ok) return JSON.stringify({ ok: false, error: checked.error });
      const notasBits = [
        "origen voz web (VW)",
        pageUrl ? `página ${pageUrl}` : "",
        checked.lead.campos_faltantes ? `faltan: ${checked.lead.campos_faltantes}` : "",
        checked.lead.quote_orientacion || "",
        STOREFRONT_FLETE_NOTE,
      ].filter(Boolean);
      try {
        const raw = await executeTool(
          "wa_lead_to_admin",
          {
            consulta: checked.lead.consulta,
            telefono: checked.lead.telefono,
            cliente: checked.lead.cliente,
            origen: STOREFRONT_LEAD_ORIGEN,
            zona: checked.lead.zona,
            notas: notasBits.join(" · "),
            ...(checked.lead.pdf_url ? { link: checked.lead.pdf_url } : {}),
            user_confirmed: true,
          },
          {},
          { source: "storefront-voice" },
        );
        recordVoiceEvent({
          kind: "storefront_lead",
          surface: "storefront",
          detail: checked.lead.zona || "lead",
        });
        return shapeToolResult("wa_lead_to_admin", raw);
      } catch (err) {
        log?.warn?.({ err }, "storefront capture_lead failed");
        return JSON.stringify({ ok: false, error: err?.message || "No se pudo guardar la consulta." });
      }
    }
    const toolInput = forceListaWeb(type, payload);
    const serverOk = STOREFRONT_READ_TOOLS.includes(type) || STOREFRONT_WRITE_TOOLS.includes(type);
    if (!serverOk || type === "capture_lead") {
      return JSON.stringify({ ok: false, error: `Tool no permitida: ${type}` });
    }
    try {
      const raw = await executeTool(type, toolInput, { listaPrecios: "web" }, { source: "storefront-voice" });
      let result = shapeToolResult(type, raw);
      try {
        result = JSON.stringify(stripInternalPrices(JSON.parse(result)));
      } catch {
        /* keep shaped string */
      }
      return result;
    } catch (err) {
      log?.warn?.({ err, type }, "storefront voice tool failed");
      return JSON.stringify({ ok: false, error: err?.message || "tool failed" });
    }
  }

  router.post("/action", actionLimiter, async (req, res) => {
    const { action } = req.body || {};
    if (!action || typeof action !== "object") {
      return res.status(400).json({ ok: false, error: "action object required" });
    }
    const type = String(action.type || action.name || "");
    const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
    if (!isPublicStorefrontTool(type)) {
      return res.status(400).json({ ok: false, error: `Tool no permitida: ${type || "(vacío)"}` });
    }
    const pageUrl = sanitizePageUrl(req.body?.pageUrl);
    const result = await runPublicStorefrontTool(type, payload, pageUrl, req.log);
    return res.json({ ok: true, kind: "tool", result });
  });

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.appEnv === "development" ? 60 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    skip: () => config.appEnv === "development",
    message: { ok: false, error: "Demasiados mensajes. Esperá un momento." },
  });

  router.post("/chat", chatLimiter, async (req, res) => {
    const pageUrl = sanitizePageUrl(req.body?.pageUrl || req.body?.page_url);
    const pack = buildStorefrontVoicePack({ pageUrl });
    try {
      const out = await runStorefrontTextTurn({
        message: req.body?.message,
        history: req.body?.history,
        pageUrl,
        toolResults: req.body?.tool_results,
        pack,
        runServerTool: (name, args) => runPublicStorefrontTool(name, args || {}, pageUrl, req.log),
      });
      recordVoiceEvent({ kind: "storefront_chat", surface: "storefront", detail: "text" });
      return res.json(out);
    } catch (err) {
      const status = Number(err?.status) || 500;
      req.log?.warn?.({ err }, "storefront text chat failed");
      recordVoiceError({
        kind: "storefront_chat",
        message: err?.message || "chat failed",
        status,
      });
      return res.status(status >= 400 && status < 600 ? status : 500).json({
        ok: false,
        error: err?.message || "No se pudo responder.",
      });
    }
  });

  return router;
}
