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
  assertIdentifyLead,
  buildWhatsAppHandoff,
  STOREFRONT_READ_TOOLS,
  STOREFRONT_WRITE_TOOLS,
  STOREFRONT_LEAD_ORIGEN,
  stripInternalPrices,
  isStorefrontShopTool,
  normalizeStorefrontPhone,
} from "../lib/voice/storefrontVoicePack.js";
import { STOREFRONT_FLETE_NOTE } from "../lib/voice/storefrontAgentConfig.js";
import { runStorefrontTextTurn } from "../lib/voice/storefrontChat.js";
import { appendStorefrontTurn } from "../lib/voice/storefrontConversationLog.js";

export const STOREFRONT_SESSION_WINDOW_MS = 5 * 60 * 1000;
const ACTION_MAX = 120;

export function storefrontSessionMax(appEnv = config.appEnv) {
  return appEnv === "development" ? 30 : 12;
}

export function skipStorefrontSessionLimit(req, appEnv = config.appEnv) {
  if (appEnv === "development") return true;
  if (String(req?.method || "").toUpperCase() === "OPTIONS") return true;
  return false;
}

/** Log payload for /action 200 and 4xx. */
export function storefrontActionLogPayload(type, httpStatus) {
  return { actionType: String(type || ""), status: Number(httpStatus) || 0 };
}

export function shouldAttemptAdminColJ(adminRow) {
  const n = Number(adminRow);
  return Number.isFinite(n) && n >= 2;
}

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
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
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

/** `{ error }` without `ok: false` used to look like identify success. */
export function parseStorefrontToolJson(raw) {
  let parsed = {};
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : (raw && typeof raw === "object" ? raw : {});
  } catch {
    return { ok: false, error: String(raw || "invalid tool result").slice(0, 300) };
  }
  if (parsed && parsed.ok === true) return parsed;
  return {
    ok: false,
    error: parsed?.error || "No se pudo guardar en Admin 2.0.",
  };
}

/** Admin 2.0 data rows start at 2. Reject MAN-* ids used as a fake row. */
export function storefrontAdminRow(parsed) {
  const n = Number(parsed?.adminRow);
  return Number.isFinite(n) && n >= 2 ? n : null;
}

/** Identify / capture_lead: `{error}` or missing row is 502-class failure. */
export function evaluateStorefrontLead(raw) {
  const parsed = parseStorefrontToolJson(raw);
  const adminRow = storefrontAdminRow(parsed);
  if (!parsed.ok || !adminRow) {
    return {
      ok: false,
      adminRow: null,
      error: parsed.error || "Admin 2.0 no devolvió el número de fila.",
      httpStatus: 502,
      recordMetrics: false,
    };
  }
  return {
    ok: true,
    adminRow,
    id: parsed.id || null,
    parsed,
    httpStatus: 200,
    recordMetrics: true,
  };
}

export function shouldRecordStorefrontLeadMetrics(ev) {
  return Boolean(ev?.ok && ev?.recordMetrics && Number(ev.adminRow) >= 2);
}

export default function createPublicVoiceRouter() {
  const router = Router();

  router.use(flagGuard);
  router.use(originGuard);

  const sessionLimiter = rateLimit({
    windowMs: STOREFRONT_SESSION_WINDOW_MS,
    max: storefrontSessionMax(config.appEnv),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIp,
    skip: (req) => skipStorefrontSessionLimit(req, config.appEnv),
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
    const shopperName = String(req.body?.shopperName || req.body?.nombre || "").trim().slice(0, 80);
    const pack = buildStorefrontVoicePack({ pageUrl, shopperName });

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
      const adminRow = Number(payload.adminRow);
      const notasBits = [
        "origen voz web (VW)",
        pageUrl ? `página ${pageUrl}` : "",
        checked.lead.campos_faltantes ? `faltan: ${checked.lead.campos_faltantes}` : "",
        checked.lead.quote_orientacion || "",
        STOREFRONT_FLETE_NOTE,
      ].filter(Boolean);
      try {
        if (Number.isFinite(adminRow) && adminRow >= 2) {
          const raw = await executeTool(
            "wolfboard_actualizar_fila",
            {
              rowNum: adminRow,
              respuesta: notasBits.join(" · ").slice(0, 8000),
              ...(checked.lead.pdf_url ? { linkDrive: checked.lead.pdf_url } : {}),
              user_confirmed: true,
            },
            {},
            { source: "storefront-voice" },
          );
          const parsed = parseStorefrontToolJson(raw);
          if (!parsed.ok) return JSON.stringify(parsed);
          recordVoiceEvent({
            kind: "storefront_lead_update",
            surface: "storefront",
            detail: String(adminRow),
          });
          return JSON.stringify({ ...parsed, ok: true, adminRow });
        }
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
        const ev = evaluateStorefrontLead(raw);
        if (!ev.ok) {
          return JSON.stringify({ ok: false, error: ev.error });
        }
        if (shouldRecordStorefrontLeadMetrics(ev)) {
          recordVoiceEvent({
            kind: "storefront_lead",
            surface: "storefront",
            detail: String(ev.adminRow),
          });
        }
        return JSON.stringify({ ...ev.parsed, ok: true, adminRow: ev.adminRow });
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
      const type = "";
      req.log?.info?.(storefrontActionLogPayload(type, 400), "storefront action");
      return res.status(400).json({ ok: false, error: "action object required" });
    }
    const type = String(action.type || action.name || "");
    const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
    if (!isPublicStorefrontTool(type)) {
      req.log?.info?.(storefrontActionLogPayload(type, 400), "storefront action");
      return res.status(400).json({ ok: false, error: `Tool no permitida: ${type || "(vacío)"}` });
    }
    const pageUrl = sanitizePageUrl(req.body?.pageUrl);
    const leadMeta = req.body?.lead && typeof req.body.lead === "object" ? req.body.lead : {};
    if (type === "capture_lead" && Number(leadMeta.adminRow) >= 2) {
      payload.adminRow = Number(leadMeta.adminRow);
    }
    const result = await runPublicStorefrontTool(type, payload, pageUrl, req.log);
    req.log?.info?.(storefrontActionLogPayload(type, 200), "storefront action");
    return res.json({ ok: true, kind: "tool", result });
  });

  router.post("/identify", actionLimiter, async (req, res) => {
    const pageUrl = sanitizePageUrl(req.body?.pageUrl || req.body?.page_url);
    const checked = assertIdentifyLead({
      cliente: req.body?.cliente || req.body?.nombre,
      telefono: req.body?.telefono,
      zona: req.body?.zona,
      consent: req.body?.consent,
    });
    if (!checked.ok) return res.status(400).json({ ok: false, error: checked.error });
    const result = await runPublicStorefrontTool(
      "capture_lead",
      { ...checked.lead, consent: true },
      pageUrl,
      req.log,
    );
    const ev = evaluateStorefrontLead(result);
    appendStorefrontTurn({
      kind: ev.ok ? "identify" : "identify_failed",
      adminRow: ev.adminRow,
      telefono: checked.lead.telefono,
      pageUrl,
      transcript: checked.lead.consulta,
    });
    if (!ev.ok) {
      req.log?.warn?.({ err: ev.error }, "storefront identify missing adminRow");
      return res.status(ev.httpStatus).json({
        ok: false,
        error: ev.error,
      });
    }
    if (shouldRecordStorefrontLeadMetrics(ev)) {
      recordVoiceEvent({ kind: "storefront_identify", surface: "storefront", detail: String(ev.adminRow) });
    }
    return res.json({
      ok: true,
      adminRow: ev.adminRow,
      id: ev.id || null,
      cliente: checked.lead.cliente,
      telefono: checked.lead.telefono,
    });
  });

  router.post("/log", actionLimiter, async (req, res) => {
    const adminRow = Number(req.body?.adminRow);
    const telefono = normalizeStorefrontPhone(req.body?.telefono);
    const transcript = String(req.body?.transcript || "").trim().slice(0, 8000);
    const pageUrl = sanitizePageUrl(req.body?.pageUrl || req.body?.page_url);
    if (telefono.length < 8) {
      return res.status(400).json({ ok: false, error: "Teléfono requerido para loguear el chat." });
    }
    if (!transcript) return res.json({ ok: true, skipped: true });
    appendStorefrontTurn({
      kind: "log",
      adminRow: shouldAttemptAdminColJ(adminRow) ? adminRow : null,
      telefono,
      pageUrl,
      transcript,
    });
    if (!shouldAttemptAdminColJ(adminRow)) {
      return res.status(400).json({ ok: false, error: "adminRow requerido." });
    }
    try {
      const raw = await executeTool(
        "wolfboard_actualizar_fila",
        { rowNum: adminRow, respuesta: transcript, user_confirmed: true },
        {},
        { source: "storefront-voice" },
      );
      const parsed = parseStorefrontToolJson(raw);
      if (parsed.ok !== true) {
        return res.status(502).json({ ok: false, error: parsed.error || "No se pudo guardar el chat." });
      }
      recordVoiceEvent({ kind: "storefront_chat_log", surface: "storefront", detail: String(adminRow) });
      return res.json({ ok: true, adminRow });
    } catch (err) {
      req.log?.warn?.({ err }, "storefront chat log failed");
      return res.status(502).json({ ok: false, error: err?.message || "No se pudo guardar el chat." });
    }
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
    const shopperName = String(req.body?.shopperName || req.body?.nombre || "").trim().slice(0, 80);
    const pack = buildStorefrontVoicePack({ pageUrl, shopperName });
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
