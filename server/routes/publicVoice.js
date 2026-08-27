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
  mintStorefrontRowProof,
  verifyStorefrontRowProof,
} from "../lib/voice/storefrontVoicePack.js";
import { STOREFRONT_FLETE_NOTE } from "../lib/voice/storefrontAgentConfig.js";
import { runStorefrontTextTurn } from "../lib/voice/storefrontChat.js";

const SESSION_WINDOW_MS = 5 * 60 * 1000;
const SESSION_MAX = config.appEnv === "development" ? 30 : 3;
const ACTION_MAX = 120;

/** Signing key for Admin row ownership proofs (public storefront). */
function storefrontRowProofSecret() {
  return config.apiAuthToken || config.identityJwtSecret || "";
}

/**
 * Bind capture_lead updates to the shopper's identified Admin row.
 * Never trust model-supplied adminRow alone — require HMAC rowProof from /identify.
 */
function applyLeadOwnership(payload, leadMeta = {}) {
  const out = { ...(payload && typeof payload === "object" ? payload : {}) };
  delete out.adminRow;
  delete out.rowProof;
  const row = Number(leadMeta.adminRow);
  const proof = leadMeta.rowProof != null ? String(leadMeta.rowProof) : "";
  if (Number.isFinite(row) && row >= 2 && proof) {
    out.adminRow = row;
    out.rowProof = proof;
    if (leadMeta.telefono) out.telefono = leadMeta.telefono;
    if (leadMeta.cliente) out.cliente = leadMeta.cliente;
  }
  return out;
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
      const wantsUpdate = Number.isFinite(adminRow) && adminRow >= 2;
      if (wantsUpdate) {
        const secret = storefrontRowProofSecret();
        if (
          !secret ||
          !verifyStorefrontRowProof(payload.rowProof, adminRow, checked.lead.telefono, secret)
        ) {
          return JSON.stringify({
            ok: false,
            error: "Sesión de fila inválida. Volvé a identificarte para actualizar Admin 2.0.",
          });
        }
      }
      const notasBits = [
        "origen voz web (VW)",
        pageUrl ? `página ${pageUrl}` : "",
        checked.lead.campos_faltantes ? `faltan: ${checked.lead.campos_faltantes}` : "",
        checked.lead.quote_orientacion || "",
        STOREFRONT_FLETE_NOTE,
      ].filter(Boolean);
      try {
        if (wantsUpdate) {
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
          recordVoiceEvent({
            kind: "storefront_lead_update",
            surface: "storefront",
            detail: String(adminRow),
          });
          return shapeToolResult("wolfboard_actualizar_fila", raw);
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
    let payload = action.payload && typeof action.payload === "object" ? action.payload : {};
    if (!isPublicStorefrontTool(type)) {
      return res.status(400).json({ ok: false, error: `Tool no permitida: ${type || "(vacío)"}` });
    }
    const pageUrl = sanitizePageUrl(req.body?.pageUrl);
    const leadMeta = req.body?.lead && typeof req.body.lead === "object" ? req.body.lead : {};
    if (type === "capture_lead") {
      payload = applyLeadOwnership(payload, leadMeta);
    }
    const result = await runPublicStorefrontTool(type, payload, pageUrl, req.log);
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
    let parsed = {};
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { ok: false, error: result };
    }
    if (parsed.ok === false) {
      return res.status(502).json({ ok: false, error: parsed.error || "No se pudo guardar en Admin 2.0." });
    }
    const adminRow = Number(parsed.adminRow);
    const secret = storefrontRowProofSecret();
    const rowProof =
      Number.isFinite(adminRow) && adminRow >= 2 && secret
        ? mintStorefrontRowProof(adminRow, checked.lead.telefono, secret)
        : null;
    if (Number.isFinite(adminRow) && adminRow >= 2 && !rowProof) {
      req.log?.warn?.("storefront identify: missing API_AUTH_TOKEN/IDENTITY_JWT_SECRET for rowProof");
    }
    recordVoiceEvent({ kind: "storefront_identify", surface: "storefront", detail: "gate" });
    return res.json({
      ok: true,
      adminRow: Number.isFinite(adminRow) && adminRow >= 2 ? adminRow : null,
      id: parsed.id || null,
      rowProof,
      cliente: checked.lead.cliente,
      telefono: checked.lead.telefono,
    });
  });

  router.post("/log", actionLimiter, async (req, res) => {
    const adminRow = Number(req.body?.adminRow);
    const telefono = normalizeStorefrontPhone(req.body?.telefono);
    const transcript = String(req.body?.transcript || "").trim().slice(0, 8000);
    const rowProof = req.body?.rowProof;
    if (!Number.isFinite(adminRow) || adminRow < 2) {
      return res.status(400).json({ ok: false, error: "adminRow requerido." });
    }
    if (telefono.length < 8) {
      return res.status(400).json({ ok: false, error: "Teléfono requerido para loguear el chat." });
    }
    const secret = storefrontRowProofSecret();
    if (!secret || !verifyStorefrontRowProof(rowProof, adminRow, telefono, secret)) {
      return res.status(403).json({
        ok: false,
        error: "Sesión de fila inválida. Volvé a identificarte para loguear el chat.",
      });
    }
    if (!transcript) return res.json({ ok: true, skipped: true });
    try {
      const raw = await executeTool(
        "wolfboard_actualizar_fila",
        { rowNum: adminRow, respuesta: transcript, user_confirmed: true },
        {},
        { source: "storefront-voice" },
      );
      let parsed = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { ok: false };
      }
      if (parsed.ok === false) {
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
    const leadMeta = req.body?.lead && typeof req.body.lead === "object" ? req.body.lead : {};
    try {
      const out = await runStorefrontTextTurn({
        message: req.body?.message,
        history: req.body?.history,
        pageUrl,
        toolResults: req.body?.tool_results,
        pack,
        runServerTool: (name, args) => {
          const payload =
            name === "capture_lead" ? applyLeadOwnership(args || {}, leadMeta) : args || {};
          return runPublicStorefrontTool(name, payload, pageUrl, req.log);
        },
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
