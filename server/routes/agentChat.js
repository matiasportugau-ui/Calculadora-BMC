/**
 * POST /api/agent/chat — SSE streaming endpoint for the Panelin AI agent.
 *
 * Provider chain: default claude → grok → gemini → openai; optional `aiProvider` + `aiModel` (see GET /api/agent/ai-options).
 *
 * Request:  { messages: [{role, content}], calcState: {...}, aiProvider?: "auto"|"claude"|"openai"|"grok"|"gemini", aiModel?: string, surface?: "panelin_chat"|"mercado_libre"|"whatsapp"|"email"|"wolfboard" }
 * Response: text/event-stream, events:
 *   {"type":"text","delta":"..."}
 *   {"type":"action","action":{"type":"setTecho","payload":{...}}}
 *   {"type":"suggestions","suggestions":{"groups":[{"title":"…","items":[{"label":"…","send":"…"}]}]}}
 *        (model SUGGEST_JSON:… lines, or server-injected after Wolfboard tools in devMode)
 *   {"type":"done"}
 *   {"type":"error","message":"..."}
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import pino from "pino";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import { checkDevModeAuthorization } from "../lib/devModeAuth.js";
import { buildSystemPrompt } from "../lib/chatPrompts.js";
import {
  calcParedCompleto,
  calcTechoCompleto,
  calcTotalesSinIVA,
  mergeZonaResults,
  perimetroVerticalInteriorPuntosDesdePlanta,
} from "../../src/utils/calculations.js";
import { PANELS_TECHO, setListaPrecios } from "../../src/data/constants.js";
import { appendTrainingSessionEvent, findRelevantExamples, addTrainingEntry, ensureGcsInit, resolveTrainingAnswer } from "../lib/trainingKB.js";
import { normalizeSurface as kbSurfaceForTraining } from "../lib/kbSurface.js";
import { normalizeSurface as canonicalBrandSurface, surfaceToChannel, SURFACES } from "../lib/surface.js";
import { extractLearnablePairs } from "../lib/autoLearnExtractor.js";
import {
  logConversationMeta,
  logConversationTurn,
  logConversationAction,
  closeConversation,
  countHedges,
} from "../lib/conversationLog.js";
import { estimateTokensSystem, estimateTokensText, CHAT_MAX_TOKENS, TOKEN_BUDGET } from "../lib/tokenEstimator.js";
import { summarizeHistory } from "../lib/chatSummarizer.js";
import { validateAndPreviewQuote } from "../lib/quotePayloadValidator.js";
import { AGENT_TOOLS, executeTool } from "../lib/agentTools.js";
import { toGeminiTools, toGeminiResponse } from "../lib/geminiTools.js";
import { getToolStats } from "../lib/toolStats.js";
import { classifyIntents } from "../lib/userIntentClassifier.js";
import { normalizeSuggestionsPayload } from "../lib/suggestionsNormalize.js";
import { wolfboardSuggestionsAfterTool } from "../lib/wolfboardChatSuggestions.js";
import { checkAndCount as budgetCheckAndCount } from "../lib/budget.js";
import { buildVerifiedQuotePayload } from "../lib/verifiedQuotePayload.js";
import { getIvaPct } from "../lib/policyLoader.js";
import { retrieveSimilarQuotes, formatRetrievedContextForPrompt } from "../lib/rag.js";
import {
  ALLOWED_MODELS as CENTRAL_ALLOWED_MODELS,
  PROVIDER_LABELS as CENTRAL_PROVIDER_LABELS,
  resolveModel as centralResolveModel,
  buildAiOptionsResponse,
  estimateCostUSD,
} from "../lib/aiProviderConfig.js";

const router = Router();

// Module logger for code paths without a request-scoped pino (req.log).
const logger = pino({ name: "agent-chat", level: process.env.LOG_LEVEL ?? "info" });

// Track which conversations have already run autolearn — prevents multi-call per session.
const _autolearned = new Set();

const SAFE_MODEL_ID = /^[a-zA-Z0-9._\-]{1,80}$/;
// Models and labels now come from the central aiProviderConfig.js (single source of truth)
const ALLOWED_MODELS = CENTRAL_ALLOWED_MODELS;
const PROVIDER_LABELS = CENTRAL_PROVIDER_LABELS;

function isSafeModelId(id) {
  return typeof id === "string" && SAFE_MODEL_ID.test(id);
}

function resolveModelForProvider(provider, requested, configuredDefault) {
  const def =
    configuredDefault && isSafeModelId(String(configuredDefault))
      ? String(configuredDefault)
      : centralResolveModel(provider, undefined, false);
  if (!requested || !String(requested).trim()) return def;
  const r = String(requested).trim();
  if (!isSafeModelId(r)) return def;
  if (ALLOWED_MODELS[provider]?.has(r)) return r;
  if (r === def) return r;
  return def;
}

function modelsForProviderUi(provider, defaultModel) {
  const ids = ALLOWED_MODELS[provider] ? [...ALLOWED_MODELS[provider]] : [];
  if (defaultModel && isSafeModelId(defaultModel) && !ids.includes(defaultModel)) ids.unshift(defaultModel);
  ids.sort((a, b) => a.localeCompare(b));
  return ids.map((id) => ({
    id,
    label: id === defaultModel ? `${id} (predeterminado)` : id,
  }));
}

/** GET /api/agent/ai-options — which providers/models the server can use (no secrets). */
router.get("/agent/ai-options", (_req, res) => {
  // Now powered by the central config for consistency across the entire AI stack
  const response = buildAiOptionsResponse();
  res.json(response);
});

/**
 * GET /api/agent/tool-stats — per-tool aggregates (count, p50/p95 latency,
 * error rate, error buckets) over the last `windowMinutes` minutes (default 1440 = 24h).
 * Used by the dev panel "Tool Stats" tab. No secrets; safe to expose without auth.
 */
router.get("/agent/tool-stats", (req, res) => {
  const minutes = Math.max(1, Math.min(7 * 24 * 60, Number(req.query?.windowMinutes || 24 * 60)));
  const stats = getToolStats({ windowMs: minutes * 60 * 1000 });
  res.json({ ok: true, ...stats });
});

/**
 * GET /api/agent/tools-manifest — list of all AGENT_TOOLS for external clients
 * (e.g. the Panelin MCP server). Returns the same Anthropic input_schema format
 * that the in-process tool-use loop receives.
 */
router.get("/agent/tools-manifest", (_req, res) => {
  res.json({
    ok: true,
    count: AGENT_TOOLS.length,
    tools: AGENT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
      requires_auth: TOOLS_REQUIRING_AUTH.has(t.name),
    })),
  });
});

/**
 * POST /api/agent/exec-tool — execute a single tool by name. Auth-gated for
 * write tools (those that mutate Sheets / WhatsApp / followups / quote registry).
 * Used by the MCP server to surface every tool to external agents.
 *
 * Body: { name: string, input: object, calcState?: object }
 * Auth: write tools, CRM-read tools, quote registry read tools, and PDF read
 *       tools require Authorization: Bearer ${API_AUTH_TOKEN}.
 *       Pure calculator / catalog reads are open.
 */
export const TOOLS_REQUIRING_AUTH = new Set([
  // Customer-facing writes
  "guardar_en_crm",
  "enviar_whatsapp_link",
  "cancelar_cotizacion",
  "programar_seguimiento",
  // CRM read tools — return customer PII (names, phones, quote links, notes)
  // from CRM_Operativo; must not be open to unauthenticated callers.
  "buscar_cliente_crm",
  "historial_cliente",
  // Quote registry / PDF read tools — return customer + quote metadata and
  // full quote HTML. Cursor + Copilot security review flagged these as
  // exposing business data through unauthenticated /api/agent/exec-tool.
  "listar_cotizaciones_recientes",
  "obtener_cotizacion_por_id",
  "obtener_pdf_html",
  "recuperar_casos_similares",
  // Wolfboard hub — all routes are admin-only and the underlying router
  // already enforces requireAuth. We mirror that gate at the MCP entry
  // so external clients can't poll pendientes / export without the token.
  "wolfboard_pendientes",
  "wolfboard_export",
  "wolfboard_sync",
  "wolfboard_actualizar_fila",
  "wolfboard_marcar_enviado",
  "wolfboard_quote_batch",
  // TraKtiMe — read/write a user's time data; the agent acts as the user
  // (forwarded JWT). Gated here so unauthenticated chat / MCP can't poll them.
  "traktime_timer_current",
  "traktime_timer_start",
  "traktime_timer_stop",
  "traktime_list_entries",
  "traktime_create_entry",
  "traktime_day_report",
  "traktime_month_report",
  "traktime_billable_report",
  "traktime_suggest_entry",
  "traktime_activity_today",
]);

/** Extract a Bearer token from a request's Authorization header, or "". */
export function bearerFromRequest(req) {
  const auth = String(req?.headers?.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

/**
 * Returns true if the chat tool loop should refuse to execute `toolName`
 * for the current session. Public (non-devMode) chat sessions may not
 * invoke any tool in TOOLS_REQUIRING_AUTH — same gate that protects
 * /api/agent/exec-tool. devMode chats are pre-authenticated by
 * API_AUTH_TOKEN at the route entry, so they pass.
 *
 * Exported for unit testing the regression Cursor flagged: prior to this
 * gate, an unauthenticated chat could prompt the model to call
 * `listar_cotizaciones_recientes` etc. and receive customer data.
 *
 * @param {string} toolName
 * @param {boolean} isDevModeAuthenticated
 * @returns {boolean}
 */
export function shouldBlockToolForUnauthenticatedChat(toolName, isDevModeAuthenticated) {
  if (isDevModeAuthenticated) return false;
  return TOOLS_REQUIRING_AUTH.has(toolName);
}

// Bound the MCP / external write surface. The chat endpoint already has
// 10/min public + 30/min dev rate limits; exec-tool inherits nothing
// without this. 60/min is generous for legitimate MCP clients while
// preventing runaway loops or abuse.
const execToolLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitClientKey,
  message: { ok: false, error: "Demasiadas invocaciones de tool. Esperá un momento." },
});

router.post("/agent/exec-tool", execToolLimiter, async (req, res) => {
  try {
    const { name, input, calcState = {} } = req.body || {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ ok: false, error: "name (string) requerido" });
    }
    const tool = AGENT_TOOLS.find((t) => t.name === name);
    if (!tool) {
      return res.status(404).json({ ok: false, error: `Tool "${name}" no existe en AGENT_TOOLS` });
    }
    if (TOOLS_REQUIRING_AUTH.has(name)) {
      const auth = String(req.headers.authorization || "");
      const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const xKey = String(req.headers["x-api-key"] || "");
      if (!config.apiAuthToken) {
        return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN no configurado en el server" });
      }
      if (bearer !== config.apiAuthToken && xKey !== config.apiAuthToken) {
        return res.status(401).json({ ok: false, error: `Tool "${name}" requiere autorización Bearer` });
      }
    }
    // For TraKtiMe (per-user) tools, the agent acts as a user: the MCP caller
    // may pass input.user_jwt; the tool falls back to it. Service bearer here
    // is API_AUTH_TOKEN (gate only), not a user identity.
    const raw = await executeTool(name, input || {}, calcState || {}, {
      logger: req.log,
      callerAuthToken: (input && input.user_jwt) || null,
    });
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
    res.json({ ok: true, name, result: parsed });
  } catch (err) {
    req.log?.error({ err }, "agent/exec-tool failed");
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 0.4 — Allowed origins (CSRF guard)
const ALLOWED_ORIGINS = new Set([
  "https://calculadora-bmc.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function rateLimitClientKey(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/** Allows Vercel previews (*.vercel.app) and localhost dev; exact list for canonical URLs. */
function isChatOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
  } catch {
    return false;
  }
  return false;
}

// 0.4 — Allowed action types
const VALID_ACTION_TYPES = new Set([
  "setScenario", "setLP", "setTecho", "setTechoZonas",
  "setPared", "setCamara", "setFlete", "setProyecto",
  "setWizardStep", "advanceWizard",
  "buildQuote",
]);

// 0.1 — Rate limiting: 10/min public, 30/min devMode
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitClientKey,
  message: { ok: false, error: "Demasiadas consultas. Esperá un momento." },
  skip: () => false, // devMode bypass is handled post-parse via devModeLimiter
});

const devModeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitClientKey,
  message: { ok: false, error: "Demasiadas consultas en modo dev. Esperá un momento." },
});

function runCalcTecho(techo = {}) {
  const is2A = techo.tipoAguas === "dos_aguas";
  const zonas = Array.isArray(techo.zonas) && techo.zonas.length > 0
    ? techo.zonas
    : [{ largo: Number(techo.largo) || 0, ancho: Number(techo.ancho) || 0 }];

  const zonaResults = zonas.flatMap((zona, gi) => {
    const perimVertPts =
      !is2A && zonas.length
        ? perimetroVerticalInteriorPuntosDesdePlanta(zonas, techo.tipoAguas, gi)
        : undefined;
    if (is2A) {
      const ha = +(Number(zona.ancho || 0) / 2).toFixed(2);
      const a1 = calcTechoCompleto({
        ...techo,
        largo: Number(zona.largo) || 0,
        ancho: ha,
        borders: { ...techo.borders, fondo: "cumbrera" },
      });
      const a2 = calcTechoCompleto({
        ...techo,
        largo: Number(zona.largo) || 0,
        ancho: ha,
        borders: {
          frente: techo.borders?.fondo === "cumbrera" ? "cumbrera" : (techo.borders?.fondo || "none"),
          fondo: "none",
          latIzq: techo.borders?.latIzq || "none",
          latDer: techo.borders?.latDer || "none",
        },
      });
      return [a1, a2];
    }
    return [
      calcTechoCompleto({
        ...techo,
        largo: Number(zona.largo) || 0,
        ancho: Number(zona.ancho) || 0,
        ...(perimVertPts != null ? { perimetroVerticalInteriorPuntos: perimVertPts } : {}),
      }),
    ];
  });

  return mergeZonaResults(zonaResults);
}

function resolveTechoForCamara(paredFamilia, paredEspesor) {
  const familia = paredFamilia in PANELS_TECHO ? paredFamilia : "ISODEC_EPS";
  const panel = PANELS_TECHO[familia];
  if (!panel) return { familia: "ISODEC_EPS", espesor: 100 };
  if (panel.esp[paredEspesor]) return { familia, espesor: paredEspesor };
  const available = Object.keys(panel.esp).map(Number).sort((a, b) => a - b);
  const espesor = available.find((e) => e >= Number(paredEspesor)) || available[available.length - 1] || 100;
  return { familia, espesor };
}

function runCalculationFromState(calcState = {}) {
  const { scenario, listaPrecios, techo = {}, pared = {}, camara = {} } = calcState;
  if (!scenario) return null;
  setListaPrecios(listaPrecios === "venta" ? "venta" : "web");

  if (scenario === "solo_techo" && techo.familia && techo.espesor) {
    return runCalcTecho(techo);
  }
  if (scenario === "solo_fachada" && pared.familia && pared.espesor) {
    return calcParedCompleto(pared);
  }
  if (scenario === "techo_fachada") {
    const rT = techo.familia && techo.espesor ? runCalcTecho(techo) : null;
    const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
    const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
    if (allItems.length === 0) return null;
    const totales = calcTotalesSinIVA(allItems);
    return { ...rT, paredResult: rP, allItems, totales };
  }
  if (scenario === "camara_frig" && pared.familia && pared.espesor && camara.largo_int && camara.ancho_int && camara.alto_int) {
    const perim = 2 * (Number(camara.largo_int) + Number(camara.ancho_int));
    const rP = calcParedCompleto({
      ...pared,
      perimetro: perim,
      alto: Number(camara.alto_int),
      numEsqExt: 4,
      numEsqInt: 0,
    });
    const techoMap = resolveTechoForCamara(pared.familia, pared.espesor);
    const rT = calcTechoCompleto({
      familia: techoMap.familia,
      espesor: techoMap.espesor,
      largo: Number(camara.largo_int),
      ancho: Number(camara.ancho_int),
      tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      color: pared.color || "Blanco",
    });
    const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
    if (allItems.length === 0) return null;
    const totales = calcTotalesSinIVA(allItems);
    return { ...rP, techoResult: rT, allItems, totales };
  }
  return null;
}

function extractQuotedUsd(text = "") {
  const values = [];
  const rx = /(USD|\$)\s*([0-9][0-9.,]*)/gi;
  let match = rx.exec(text);
  while (match) {
    const n = Number(String(match[2]).replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) values.push(n);
    match = rx.exec(text);
  }
  if (values.length === 0) return null;
  return values[values.length - 1];
}

function buildCalcValidation(calcState, assistantText) {
  const results = runCalculationFromState(calcState);
  if (!results?.allItems?.length) return { available: false, reason: "insufficient-data" };
  const totals = results.totales || calcTotalesSinIVA(results.allItems);
  const expectedTotal = Number(totals.totalFinal || 0);
  const quotedTotal = extractQuotedUsd(assistantText);
  if (!Number.isFinite(quotedTotal)) {
    return { available: true, expectedTotal, quotedTotal: null, delta: null, matches: null };
  }
  const delta = +(quotedTotal - expectedTotal).toFixed(2);
  return {
    available: true,
    expectedTotal: +expectedTotal.toFixed(2),
    quotedTotal: +quotedTotal.toFixed(2),
    delta,
    matches: Math.abs(delta) < 1.5,
  };
}

router.post("/agent/chat", async (req, res) => {
  // 0.1 — Apply rate limit (devMode gets higher limit, validated after auth)
  const {
    messages = [],
    calcState = {},
    devMode = false,
    aiProvider: rawAiProvider,
    aiModel: rawAiModel,
    conversationId: rawConvId,
    thinkingMode = false,
    channel: rawChannel,
    surface: rawSurface,
  } = req.body || {};
  // Canonical brand surface (lib/surface.js) + KB training surface (lib/kbSurface.js).
  // Body accepts `surface` and/or legacy `channel`; `surface` string wins when non-empty.
  const brandHints =
    rawSurface != null && String(rawSurface).trim() !== ""
      ? rawSurface
      : { channel: rawChannel, origen: req.body?.origen, observaciones: req.body?.observaciones };
  const brandCanonical = canonicalBrandSurface(brandHints);
  const channel = brandCanonical
    ? surfaceToChannel(brandCanonical)
    : (["chat", "ml", "wa"].includes(rawChannel) ? rawChannel : "chat");
  const surface = brandCanonical
    ? kbSurfaceForTraining(
        brandCanonical === SURFACES.INSTAGRAM || brandCanonical === SURFACES.FACEBOOK
          ? "whatsapp"
          : brandCanonical,
      )
    : kbSurfaceForTraining(rawSurface);
  const _convLoggingEnabled = devMode || config.chatLogConversations;
  const conversationId = _convLoggingEnabled && typeof rawConvId === "string" && /^[a-f0-9-]{36}$/i.test(rawConvId)
    ? rawConvId
    : null;
  const aiProvider = String(rawAiProvider || "auto").toLowerCase();
  const aiModel = rawAiModel != null ? String(rawAiModel) : "";

  // 0.4 — CSRF origin check
  const origin = req.headers.origin;
  if (origin && !isChatOriginAllowed(origin)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }

  // 0.1 — Rate limit: devMode users get higher quota if authorized
  if (devMode) {
    const auth = checkDevModeAuthorization(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    await new Promise((resolve, reject) => {
      devModeLimiter(req, res, (err) => (err ? reject(err) : resolve()));
    });
  } else {
    await new Promise((resolve, reject) => {
      publicLimiter(req, res, (err) => (err ? reject(err) : resolve()));
    });
  }

  // Check if rate limiter already sent a response
  if (res.headersSent) return;

  // 0.15 — Soft budget (per-conversation/IP). Default OFF: see config.budgetEnabled.
  // Independent from express-rate-limit: limiter caps per-IP/min; budget caps
  // per-session and per-day, including a future token cap. See runbook §4.
  if (config.budgetEnabled) {
    const identity = (typeof rawConvId === "string" && rawConvId) || rateLimitClientKey(req);
    const verdict = budgetCheckAndCount({
      identity,
      caps: {
        turnsPerMin: config.budgetTurnsPerMin,
        turnsPer5Min: config.budgetTurnsPer5Min,
        turnsPer24h: config.budgetTurnsPer24h,
        tokensPer24h: config.budgetTokensPer24h,
      },
    });
    if (!verdict.ok) {
      res.setHeader("Retry-After", String(verdict.retryAfterSec));
      return res.status(429).json({
        ok: false,
        error: "Llegaste al límite de la sesión. Volvé en un rato o iniciá una nueva conversación.",
        scope: verdict.scope,
      });
    }
  }

  // 0.2 — Input validation
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ ok: false, error: "messages array required" });
  }
  if (messages.length > 60) {
    return res.status(400).json({ ok: false, error: "Historial demasiado largo (máx. 60 mensajes)." });
  }
  for (const msg of messages) {
    if (typeof msg.content === "string" && msg.content.length > 4000) {
      msg.content = msg.content.slice(0, 4000);
    }
  }

  const hasAnthropic = !!config.anthropicApiKey;
  const hasGrok      = !!config.grokApiKey;
  const hasGemini    = !!config.geminiApiKey;
  const hasOpenAI    = !!config.openaiApiKey;

  if (!hasAnthropic && !hasGrok && !hasGemini && !hasOpenAI) {
    return res.status(503).json({ ok: false, error: "AI not configured" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx / Cloud Run buffering

  const send = (obj) => { if (!aborted) res.write(`data: ${JSON.stringify(obj)}\n\n`); };
  let visibleAssistantText = "";
  let aborted = false;
  const emittedActions = [];

  // 1.5 — Abort LLM stream on client disconnect
  const disconnectController = new AbortController();
  req.on("close", () => {
    aborted = true;
    disconnectController.abort();
  });

  // 1.4 — SSE keepalive heartbeat every 15s to prevent proxy timeouts
  const heartbeat = setInterval(() => { if (!aborted) res.write(":\n\n"); }, 15000);

  function emitAction(action) {
    if (action.type === "buildQuote") {
      const validation = validateAndPreviewQuote(action.payload);
      if (validation.valid) {
        const enriched = { ...action, preview: validation.preview, warnings: validation.preview.warnings };
        send({ type: "action", action: enriched });
        emittedActions.push(enriched);
      } else {
        // Validation failed — emit rejection event (visible in devMode) and skip applying
        send({ type: "buildQuote_rejected", errors: validation.errors });
        req.log?.warn({ errors: validation.errors }, "buildQuote rejected");
      }
    } else {
      send({ type: "action", action });
      emittedActions.push(action);
    }
  }

  /** Process buffered text: emit text events, extract ACTION_JSON / SUGGEST_JSON directives. Returns leftover tail. */
  function flushLines(buf) {
    const lines = buf.split("\n");
    const tail = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ACTION_JSON:")) {
        try {
          const action = JSON.parse(trimmed.slice("ACTION_JSON:".length).trim());
          if (VALID_ACTION_TYPES.has(action.type)) {
            emitAction(action);
          } else {
            send({ type: "text", delta: line + "\n" });
          }
        } catch {
          if (line) send({ type: "text", delta: line + "\n" });
        }
      } else if (trimmed.startsWith("SUGGEST_JSON:")) {
        try {
          const parsed = JSON.parse(trimmed.slice("SUGGEST_JSON:".length).trim());
          const normalized = normalizeSuggestionsPayload(parsed);
          if (normalized) send({ type: "suggestions", suggestions: normalized });
        } catch {
          /* ignore malformed suggestion line — never surface raw directive */
        }
      } else if (line !== "") {
        send({ type: "text", delta: line + "\n" });
        visibleAssistantText += line + "\n";
      }
    }
    return tail;
  }

  function flushTail(tail) {
    const trimmed = tail.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("ACTION_JSON:")) {
      try {
        const action = JSON.parse(trimmed.slice("ACTION_JSON:".length).trim());
        if (VALID_ACTION_TYPES.has(action.type)) {
          emitAction(action);
        } else {
          send({ type: "text", delta: trimmed });
        }
      } catch {
        send({ type: "text", delta: trimmed });
      }
    } else if (trimmed.startsWith("SUGGEST_JSON:")) {
      try {
        const parsed = JSON.parse(trimmed.slice("SUGGEST_JSON:".length).trim());
        const normalized = normalizeSuggestionsPayload(parsed);
        if (normalized) send({ type: "suggestions", suggestions: normalized });
      } catch {
        /* ignore */
      }
    } else {
      send({ type: "text", delta: trimmed });
      visibleAssistantText += trimmed;
    }
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Server-side intent classification — the only signal the model can't fabricate.
  // Write tools (guardar_en_crm, enviar_whatsapp_link, etc.) check this set, not
  // the model-set user_confirmed flag. See server/lib/userIntentClassifier.js.
  const approvedActions = classifyIntents(lastUserMessage);
  if (devMode && approvedActions.size > 0) {
    // Surface to dev panel for transparency
    setImmediate(() => {
      try {
        if (!aborted && !res.writableEnded) res.write(`data: ${JSON.stringify({ type: "approved_actions", actions: [...approvedActions] })}\n\n`);
      } catch (err) {
        // Top-20 run 2026-05-11 (#F6): error de SSE write — logueamos en vez de silenciar.
        if (req.log) req.log.warn({ err: err?.message || String(err) }, "approved_actions SSE write failed");
      }
    });
  }

  // Ensure GCS KB is loaded before reading (Cloud Run cold-start guard)
  await ensureGcsInit();

  // Always use KB — not just devMode.
  // Multi-canal (Brief §6.5): resolve the per-surface answer for each match
  // BEFORE handing them to buildSystemPrompt, so the rendering layer (which
  // serializes entry.goodAnswer) doesn't need to know about surfaces.
  const rawTrainingExamples = findRelevantExamples(lastUserMessage, { limit: 5 });
  const trainingExamples = rawTrainingExamples.map((entry) => ({
    ...entry,
    goodAnswer: resolveTrainingAnswer(entry, surface) || entry.goodAnswer || "",
  }));
  if (devMode) {
    send({ type: "kb_match", count: trainingExamples.length, surface, examples: trainingExamples.map((e) => ({ id: e.id, category: e.category, score: e.matchScore })) });
  }

  // RAG v1 — recuperación de cotizaciones históricas similares vía pgvector.
  // Feature flag: RAG_ENABLED (default false). Si el retriever falla (DB caída,
  // embedding service caído), se loggea y se continúa SIN RAG — el chat no se rompe.
  let ragContextBlock = "";
  if (config.ragEnabled) {
    try {
      const ragQuotes = await retrieveSimilarQuotes(
        lastUserMessage,
        config.ragTopK,
        config.ragThreshold,
      );
      ragContextBlock = formatRetrievedContextForPrompt(ragQuotes);
      if (devMode && ragQuotes.length > 0) {
        send({
          type: "rag_match",
          count: ragQuotes.length,
          scores: ragQuotes.map((q) => ({ lead_id: q.lead_id, similarity: q.similarity })),
        });
      }
      if (ragQuotes.length > 0) {
        req.log?.info({ rag_count: ragQuotes.length, top_score: ragQuotes[0].similarity }, "rag: retrieved quotes");
      } else {
        req.log?.debug("rag: no quotes above threshold");
      }
    } catch (ragErr) {
      // Fallo no-fatal: continuar sin RAG
      req.log?.warn({ err: ragErr }, "rag: retriever falló, continuando sin contexto histórico");
    }
  }

  // Extract last 3 assistant openings for anti-repetition guidance
  const recentAssistantMessages = messages
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => String(m.content || "").slice(0, 120));

  const systemPrompt = buildSystemPrompt(calcState, { trainingExamples, devMode, recentAssistantMessages, channel, ragContext: ragContextBlock });

  // Use a monotonically increasing global index so user and assistant turns never collide.
  // messages includes the current user message, so all-messages-count - 1 = new user global index.
  const allTurns = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const turnIndex = allTurns.length - 1;
  if (conversationId && allTurns.length === 1) {
    const meta = { devMode };
    if (typeof aiProvider === "string" && aiProvider !== "auto") meta.provider = aiProvider;
    if (typeof aiModel === "string" && aiModel.trim()) meta.model = aiModel.trim();
    logConversationMeta(conversationId, meta);
  }

  // Log user turn
  if (conversationId) {
    logConversationTurn(conversationId, { turnIndex, role: "user", content: lastUserMessage });
  }

  let filteredMsgs = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));

  // Summarize older history at >12 messages to save tokens while preserving context.
  // The summary is appended to the system prompt (all providers accept system-level context),
  // and only recent user/assistant turns remain in the messages array.
  let effectiveSystemPrompt = systemPrompt;
  try {
    const summarizeResult = await summarizeHistory(filteredMsgs);
    if (summarizeResult.summarized) {
      const summaryMsg = summarizeResult.messages.find((m) => m.role === "system");
      if (summaryMsg?.content) {
        effectiveSystemPrompt = `${systemPrompt}\n\n${summaryMsg.content}`;
      }
      filteredMsgs = summarizeResult.messages.filter((m) => m.role === "user" || m.role === "assistant");
      send({ type: "info", message: "Se resumió el historial previo para ahorrar tokens." });
    }
  } catch {
    // Summarization is best-effort; fall back to raw history on failure
  }

  // 1.7 — Truncate history to stay within token budget (improved estimate for Spanish)
  const SYSTEM_ESTIMATE = estimateTokensSystem(effectiveSystemPrompt);
  let tokenSum = SYSTEM_ESTIMATE;
  const truncated = [];
  for (let i = filteredMsgs.length - 1; i >= 0; i--) {
    const t = estimateTokensText(filteredMsgs[i].content);
    if (tokenSum + t > TOKEN_BUDGET && truncated.length >= 2) break;
    tokenSum += t;
    truncated.unshift(filteredMsgs[i]);
  }
  if (truncated.length < filteredMsgs.length) {
    send({ type: "info", message: "Se truncó el historial para mantener la calidad de la respuesta." });
  }
  const msgs = truncated;

  const defaultOrder = [];
  if (hasAnthropic) defaultOrder.push("claude");
  if (hasGrok) defaultOrder.push("grok");
  if (hasGemini) defaultOrder.push("gemini");
  if (hasOpenAI) defaultOrder.push("openai");

  const pref =
    aiProvider === "claude" || aiProvider === "grok" || aiProvider === "gemini" || aiProvider === "openai"
      ? aiProvider
      : "auto";
  const prefOk =
    (pref === "claude" && hasAnthropic) ||
    (pref === "grok" && hasGrok) ||
    (pref === "gemini" && hasGemini) ||
    (pref === "openai" && hasOpenAI);

  const providerChain =
    pref !== "auto" && prefOk
      ? [pref, ...defaultOrder.filter((p) => p !== pref)]
      : defaultOrder;

  const modelDefaults = {
    claude: config.anthropicChatModel,
    openai: config.openaiChatModel,
    grok: config.grokChatModel,
    gemini: config.geminiChatModel,
  };

  for (const provider of providerChain) {
    try {
      // Reset per-attempt accumulators so a mid-stream failure doesn't contaminate the next provider's log entry
      visibleAssistantText = "";
      emittedActions.length = 0;
      let buf = "";
      let resolvedModel = "";
      const tStart = Date.now();
      let inputTokens = 0;
      let outputTokens = 0;

      const useRequestedModel = pref !== "auto" && prefOk && provider === pref;
      const requestedId = useRequestedModel ? aiModel : "";

      if (provider === "claude") {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const model = resolveModelForProvider("claude", requestedId, modelDefaults.claude);
        resolvedModel = model;

        const isOpus47 = model === "claude-opus-4-7";
        const supportsEffort = isOpus47
          || model === "claude-opus-4-6"
          || model === "claude-sonnet-4-6";

        const claudeOpts = {
          model,
          max_tokens: thinkingMode ? (isOpus47 ? 8192 : 4096) : CHAT_MAX_TOKENS,
          system: [{ type: "text", text: effectiveSystemPrompt, cache_control: { type: "ephemeral" } }],
          messages: msgs,
          tools: AGENT_TOOLS,
          tool_choice: { type: "auto" },
        };

        if (thinkingMode) {
          if (isOpus47) {
            claudeOpts.thinking = { type: "adaptive", display: "summarized" };
            claudeOpts.output_config = { effort: "xhigh" };
          } else {
            claudeOpts.thinking = { type: "enabled", budget_tokens: 2048 };
          }
          send({ type: "thinking_start" });
        } else if (supportsEffort) {
          claudeOpts.output_config = { effort: "high" };
        }

        let cacheReadTokens = 0;
        // Tool-use loop: model may call tools up to 8 times before final response.
        // Higher cap accommodates the slot-fill → calc → pdf → crm-format → crm-save chain.
        const toolMsgs = [...msgs];
        for (let toolRound = 0; toolRound < 8; toolRound++) {
          const stream = anthropic.messages.stream({ ...claudeOpts, messages: toolMsgs });
          const toolCalls = [];
          let roundText = "";

          for await (const chunk of stream) {
            if (chunk.type === "message_start" && chunk.message?.usage) {
              cacheReadTokens = chunk.message.usage.cache_read_input_tokens ?? 0;
              inputTokens += chunk.message.usage.input_tokens ?? 0;
            }
            if (chunk.type === "message_delta" && chunk.usage) {
              outputTokens += chunk.usage.output_tokens ?? 0;
            }
            if (chunk.type === "content_block_start" && chunk.content_block?.type === "tool_use") {
              toolCalls.push({ id: chunk.content_block.id, name: chunk.content_block.name, inputRaw: "" });
            }
            if (chunk.type === "content_block_delta") {
              if (chunk.delta?.type === "input_json_delta" && toolCalls.length > 0) {
                toolCalls[toolCalls.length - 1].inputRaw += chunk.delta.partial_json || "";
              }
              if (chunk.delta?.type === "text_delta" && chunk.delta.text) {
                roundText += chunk.delta.text;
                buf += chunk.delta.text;
                buf = flushLines(buf);
              }
            }
          }

          const finalMsg = await stream.finalMessage();
          const stopReason = finalMsg?.stop_reason;

          if (toolCalls.length === 0 || stopReason !== "tool_use") break;

          // Execute all tool calls for this round (sequential to preserve order)
          const assistantContent = finalMsg.content || [];
          const toolResults = [];
          for (const tc of toolCalls) {
            let toolInput = {};
            try { toolInput = JSON.parse(tc.inputRaw || "{}"); } catch { /* ignore malformed */ }
            // Auth gate for the chat tool loop: same TOOLS_REQUIRING_AUTH set
            // that protects /api/agent/exec-tool. Without this, an
            // unauthenticated chat session can prompt the model to fire
            // sensitive registry/CRM/PDF reads (Cursor finding) — the chat
            // route is public, but devMode chat is auth-gated by API_AUTH_TOKEN
            // (lines 472-484 above), so devMode === true is our authenticated
            // signal. Public chat must not be able to execute auth-required
            // tools regardless of what the model decides to call.
            if (shouldBlockToolForUnauthenticatedChat(tc.name, devMode)) {
              const blockedResult = JSON.stringify({
                ok: false,
                error: `Esta tool (${tc.name}) requiere autenticación. El operador debe conectarse en modo desarrollador (Ctrl+Shift+D + token API) antes de ejecutar lecturas de CRM / registry / PDF o escrituras.`,
              });
              send({ type: "tool_call", tool: tc.name, input: toolInput, blocked: "auth_required" });
              req.log?.warn({ tool: tc.name }, "chat tool blocked: requires auth");
              toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: blockedResult, is_error: true });
              continue;
            }
            send({ type: "tool_call", tool: tc.name, input: toolInput });
            const result = await executeTool(tc.name, toolInput, calcState, { emitAction, approvedActions, logger: req.log, callerAuthToken: bearerFromRequest(req) || null });
            req.log?.info({ tool: tc.name, input: toolInput }, "agent tool executed");
            toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: result });

            // Trust UI: emit verified_quote when an eligible calc tool succeeded.
            // Pure helper decides eligibility + extracts the public-safe payload.
            // Wolfboard suggestions (below) parse the result independently so a
            // failure here cannot block them.
            if (!aborted) {
              try {
                const parsedTool = JSON.parse(result);
                const verified = buildVerifiedQuotePayload(tc.name, parsedTool, { ivaPct: getIvaPct() });
                if (verified) send({ type: "verified_quote", payload: verified });
              } catch {
                /* tool result not JSON — skip trust emit */
              }
            }

            // Wolfboard: deterministic quick replies (devMode only — tools are auth-gated)
            if (devMode && !aborted) {
              try {
                const parsedTool = JSON.parse(result);
                const sug = wolfboardSuggestionsAfterTool(tc.name, parsedTool);
                if (sug) send({ type: "suggestions", suggestions: sug });
              } catch {
                /* ignore malformed tool JSON */
              }
            }
          }

          toolMsgs.push({ role: "assistant", content: assistantContent });
          toolMsgs.push({ role: "user", content: toolResults });
        }

        if (thinkingMode) send({ type: "thinking_done" });
        if (devMode && cacheReadTokens > 0) {
          req.log?.info({ cacheReadTokens, model }, "Claude prompt cache hit");
        }
      } else if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = resolveModelForProvider("gemini", requestedId, modelDefaults.gemini);
        resolvedModel = model;
        // Pass the same AGENT_TOOLS Claude uses so Gemini can actually EXECUTE
        // the calculator/CRM instead of emitting <tool_code> text. The tool
        // dispatch (executeTool) is provider-agnostic; geminiTools.js only
        // adapts the schema + packages results into Gemini's shape.
        const geminiModel = genAI.getGenerativeModel({
          model,
          systemInstruction: effectiveSystemPrompt,
          tools: toGeminiTools(AGENT_TOOLS),
          // gemini-2.5-flash enables "thinking" by default, and empirically that
          // makes it role-play tool calls in TEXT (the exact bug we're fixing)
          // instead of emitting real functionCall parts. Disabling the thinking
          // budget is what flips it from narrating <tool_code> to actually
          // calling the calculator. (toolConfig ANY mode is NOT usable here —
          // the 42-tool schema exceeds Gemini's forced-call constraint budget.)
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        });
        const contents = msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        // Function-calling loop, mirroring the Claude tool-use loop above:
        // stream text → collect functionCalls → execute → feed back → repeat.
        for (let toolRound = 0; toolRound < 8; toolRound++) {
          // Client disconnected mid-loop: stop before spending another API
          // round and (critically) before executing more tools — some have
          // side effects, and nobody is listening to the SSE stream anymore.
          if (aborted) break;
          const result = await geminiModel.generateContentStream({ contents });
          for await (const chunk of result.stream) {
            let text = "";
            try { text = chunk.text(); } catch { /* function-call-only chunk */ }
            if (text) {
              buf += text;
              buf = flushLines(buf);
            }
          }

          const aggregated = await result.response;
          if (aborted) break;
          const um = aggregated?.usageMetadata;
          if (um) {
            inputTokens += um.promptTokenCount ?? 0;
            outputTokens += um.candidatesTokenCount ?? 0;
          }

          const calls =
            (typeof aggregated?.functionCalls === "function" ? aggregated.functionCalls() : null) || [];
          // Observability: if the very first round produces no function calls,
          // Gemini may have reverted to narrating tool calls in text (the
          // thinking-budget regression this path is built to prevent). Log it
          // so a model/SDK change that breaks tool-calling is visible.
          if (!calls.length && toolRound === 0) {
            req.log?.warn({ model: resolvedModel }, "gemini: no function calls in round 0 (possible tool-calling regression)");
          }
          if (!calls.length) break;

          // Record the model's function-call turn so the next request has context.
          contents.push({
            role: "model",
            parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args || {} } })),
          });

          const responseParts = [];
          for (const c of calls) {
            const toolInput = c.args || {};
            // Same auth gate as the Claude loop: public chat must not execute
            // auth-required tools regardless of what the model decides to call.
            if (shouldBlockToolForUnauthenticatedChat(c.name, devMode)) {
              const blockedResult = JSON.stringify({
                ok: false,
                error: `Esta tool (${c.name}) requiere autenticación. El operador debe conectarse en modo desarrollador (Ctrl+Shift+D + token API) antes de ejecutar lecturas de CRM / registry / PDF o escrituras.`,
              });
              send({ type: "tool_call", tool: c.name, input: toolInput, blocked: "auth_required" });
              req.log?.warn({ tool: c.name }, "chat tool blocked: requires auth (gemini)");
              responseParts.push({ functionResponse: { name: c.name, response: toGeminiResponse(blockedResult) } });
              continue;
            }
            send({ type: "tool_call", tool: c.name, input: toolInput });
            const result2 = await executeTool(c.name, toolInput, calcState, { emitAction, approvedActions, logger: req.log, callerAuthToken: bearerFromRequest(req) || null });
            req.log?.info({ tool: c.name, input: toolInput }, "agent tool executed (gemini)");
            responseParts.push({ functionResponse: { name: c.name, response: toGeminiResponse(result2) } });

            // Trust UI: emit verified_quote when an eligible calc tool succeeded
            // (identical to the Claude path).
            if (!aborted) {
              try {
                const parsedTool = JSON.parse(result2);
                const verified = buildVerifiedQuotePayload(c.name, parsedTool, { ivaPct: getIvaPct() });
                if (verified) send({ type: "verified_quote", payload: verified });
              } catch {
                /* tool result not JSON — skip trust emit */
              }
            }

            // Wolfboard: deterministic quick replies (devMode only — auth-gated).
            if (devMode && !aborted) {
              try {
                const parsedTool = JSON.parse(result2);
                const sug = wolfboardSuggestionsAfterTool(c.name, parsedTool);
                if (sug) send({ type: "suggestions", suggestions: sug });
              } catch {
                /* ignore malformed tool JSON */
              }
            }
          }

          contents.push({ role: "user", parts: responseParts });
        }
      } else {
        const { default: OpenAI } = await import("openai");
        const client =
          provider === "grok"
            ? new OpenAI({ apiKey: config.grokApiKey, baseURL: "https://api.x.ai/v1" })
            : new OpenAI({ apiKey: config.openaiApiKey });
        const model =
          provider === "grok"
            ? resolveModelForProvider("grok", requestedId, modelDefaults.grok)
            : resolveModelForProvider("openai", requestedId, modelDefaults.openai);
        resolvedModel = model;

        const stream = await client.chat.completions.create({
          model,
          max_tokens: CHAT_MAX_TOKENS,
          stream: true,
          messages: [{ role: "system", content: effectiveSystemPrompt }, ...msgs],
        });
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            buf += delta;
            buf = flushLines(buf);
          }
        }
      }

      flushTail(buf);
      if (!aborted) {
        const hedgeCount = countHedges(visibleAssistantText);
        const assistantTurnIndex = turnIndex + 1;

        // Record the actually-used provider/model so digests reflect reality
        // (client often sends aiProvider="auto"; the resolved one is only known here)
        if (conversationId) {
          logConversationMeta(conversationId, { provider, model: resolvedModel, devMode });
        }

        const latencyMs = Date.now() - tStart;
        // Top-20 run 2026-05-11 (#F1): structured log via pino (req.log) en lugar de console.log
        // para que Cloud Run capture el evento con request id correlation.
        const turnLog = {
          event: "chat_turn",
          provider,
          model: resolvedModel,
          latencyMs,
          inputTokens,
          outputTokens,
          kbMatchCount: trainingExamples.length,
          devMode: devMode || undefined,
        };
        if (req.log) req.log.info(turnLog, "chat_turn");
        else logger.info(turnLog, "chat_turn");

        // Structured cost observability for the primary AI functionality path
        const chatCost = estimateCostUSD(provider, resolvedModel, {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        });
        const costLog = {
          event: "chat_turn_cost",
          provider,
          model: resolvedModel,
          inputTokens,
          outputTokens,
          estimated_cost_usd: chatCost,
          conversationId,
        };
        if (req.log) req.log.info(costLog, "chat_turn_cost");
        else logger.info(costLog, "chat_turn_cost");

        // Log assistant turn (include per-turn hedgeCount so buildConversationFromEvents can sum)
        if (conversationId) {
          logConversationTurn(conversationId, {
            turnIndex: assistantTurnIndex,
            role: "assistant",
            content: visibleAssistantText,
            latencyMs,
            kbMatchCount: trainingExamples.length,
            hedgeCount,
          });
          // Log actions emitted this turn
          for (const action of emittedActions) {
            logConversationAction(conversationId, {
              turnIndex: assistantTurnIndex,
              actionType: action.type,
              payload: action.payload,
            });
          }
          // Close conversation event after each assistant turn (will be overwritten on next turn)
          closeConversation(conversationId, {
            turnCount: assistantTurnIndex + 1,
            hedgeCount,
          });
        }

        if (devMode) {
          const validation = buildCalcValidation(calcState, visibleAssistantText);
          send({ type: "calc_validation", validation });
          appendTrainingSessionEvent({
            type: "chat_turn",
            mode: "developer",
            provider,
            conversationId,
            kbMatches: trainingExamples.length,
            question: String(lastUserMessage || "").slice(0, 500),
            calcValidation: validation,
          });
        } else {
          // Always log production turns (minimal fields)
          appendTrainingSessionEvent({
            type: "chat_turn",
            mode: "production",
            provider,
            conversationId,
            turnIndex,
            questionLen: lastUserMessage.length,
            responseLen: visibleAssistantText.length,
            hedgeCount,
          });
        }
        send({ type: "done" });

        // Fire-and-forget autolearn — runs ONCE per conversation (not per turn).
        // Gate: production only, ≥4 turns (2 full exchanges), no prior autolearn for this convId.
        const shouldAutolearn = (
          !devMode &&
          conversationId &&
          allTurns.length >= 4 &&
          !_autolearned.has(conversationId)
        );
        if (shouldAutolearn) {
          _autolearned.add(conversationId);
          // Prune set to avoid unbounded growth (keep last 500)
          if (_autolearned.size > 500) {
            const first = _autolearned.values().next().value;
            _autolearned.delete(first);
          }
          const fullTurns = [...allTurns, { role: "assistant", content: visibleAssistantText }];
          setImmediate(() => {
            // Guard the whole body: a synchronous throw inside a setImmediate
            // callback escapes as an uncaught exception (no .catch can see it).
            try {
            extractLearnablePairs(fullTurns, { source: "panelin_chat", convId: conversationId })
              .then((pairs) => {
                for (const p of pairs) {
                  addTrainingEntry({
                    question: p.question,
                    goodAnswer: p.goodAnswer,
                    badAnswer: p.badAnswer || "",
                    category: p.category || "conversational",
                    context: p.rationale || "",
                    source: p.source || "autolearned",
                    status: p.confidence >= 0.92 ? "active" : "pending",
                    confidence: p.confidence,
                    convId: p.convId || conversationId,
                  });
                }
                if (pairs.length > 0) {
                  req.log?.info({ conversationId, pairs: pairs.length }, "autolearn: extracted KB candidates");
                }
              })
              .catch((err) => {
                req.log?.warn({ err: err.message }, "autolearn extraction failed (non-blocking)");
              });
            } catch (err) {
              req.log?.warn({ err: err?.message || String(err) }, "autolearn scheduling failed (non-blocking)");
            }
          });
        }
      }
      clearInterval(heartbeat);
      res.end();
      return; // success
    } catch (err) {
      // 1.6 — Log provider failure instead of silent catch
      req.log?.warn({ provider, err: err.message }, "provider failed, trying next");
    }
  }

  clearInterval(heartbeat);
  // All providers failed
  if (!aborted) {
    send({ type: "error", message: "Todos los proveedores de IA fallaron. Intentá más tarde." });
    res.end();
  }
});

export default router;
