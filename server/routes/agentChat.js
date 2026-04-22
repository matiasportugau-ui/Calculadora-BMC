/**
 * POST /api/agent/chat — SSE streaming endpoint for the Panelin AI agent.
 *
 * Provider chain: default claude → grok → gemini → openai; optional `aiProvider` + `aiModel` (see GET /api/agent/ai-options).
 *
 * Request:  { messages: [{role, content}], calcState: {...}, aiProvider?: "auto"|"claude"|"openai"|"grok"|"gemini", aiModel?: string }
 * Response: text/event-stream, events:
 *   {"type":"text","delta":"..."}
 *   {"type":"action","action":{"type":"setTecho","payload":{...}}}
 *   {"type":"done"}
 *   {"type":"error","message":"..."}
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import { buildSystemPrompt } from "../lib/chatPrompts.js";
import {
  calcParedCompleto,
  calcTechoCompleto,
  calcTotalesSinIVA,
  mergeZonaResults,
  perimetroVerticalInteriorPuntosDesdePlanta,
} from "../../src/utils/calculations.js";
import { PANELS_TECHO, setListaPrecios } from "../../src/data/constants.js";
import { appendTrainingSessionEvent, findRelevantExamples } from "../lib/trainingKB.js";
import {
  logConversationMeta,
  logConversationTurn,
  logConversationAction,
  closeConversation,
  countHedges,
} from "../lib/conversationLog.js";
import {
  estimateTokensSystem,
  estimateTokensText,
  CHAT_MAX_TOKENS,
  getTokenBudgetForModel,
} from "../lib/tokenEstimator.js";
import { summarizeHistory } from "../lib/chatSummarizer.js";
import { validateAndPreviewQuote } from "../lib/quotePayloadValidator.js";

const router = Router();

const SAFE_MODEL_ID = /^[a-zA-Z0-9._\-]{1,80}$/;
/** @type {Record<string, Set<string>>} */
const ALLOWED_MODELS = {
  claude: new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-20241022",
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
  ]),
  openai: new Set(["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-4", "o4-mini", "o3-mini"]),
  grok: new Set(["grok-3-mini", "grok-3", "grok-2-latest", "grok-2-vision-1212", "grok-2-1212"]),
  gemini: new Set([
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
  ]),
};

const PROVIDER_LABELS = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  grok: "Grok (xAI)",
  gemini: "Gemini (Google)",
};

function isSafeModelId(id) {
  return typeof id === "string" && SAFE_MODEL_ID.test(id);
}

function resolveModelForProvider(provider, requested, configuredDefault) {
  const def =
    configuredDefault && isSafeModelId(String(configuredDefault))
      ? String(configuredDefault)
      : [...(ALLOWED_MODELS[provider] || [])][0] || "gpt-4o-mini";
  if (!requested || !String(requested).trim()) return def;
  const r = String(requested).trim();
  if (!isSafeModelId(r)) return def;
  if (ALLOWED_MODELS[provider]?.has(r)) return r;
  if (r === def) return r;
  return def;
}

function truncateHistoryToBudget(messages, systemPrompt, budget) {
  const systemEstimate = estimateTokensSystem(systemPrompt);
  let tokenSum = systemEstimate;
  const truncated = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const estimate = estimateTokensText(messages[i].content);
    if (tokenSum + estimate > budget && truncated.length >= 2) break;
    tokenSum += estimate;
    truncated.unshift(messages[i]);
  }
  return {
    messages: truncated,
    truncated: truncated.length < messages.length,
    estimatedTokens: tokenSum,
  };
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
  const defs = {
    claude: config.anthropicChatModel,
    openai: config.openaiChatModel,
    grok: config.grokChatModel,
    gemini: config.geminiChatModel,
  };
  const keys = {
    claude: !!config.anthropicApiKey,
    openai: !!config.openaiApiKey,
    grok: !!config.grokApiKey,
    gemini: !!config.geminiApiKey,
  };
  const providers = [];
  for (const id of ["claude", "openai", "grok", "gemini"]) {
    if (!keys[id]) continue;
    const defaultModel = resolveModelForProvider(id, undefined, defs[id]);
    providers.push({
      id,
      label: PROVIDER_LABELS[id] || id,
      defaultModel,
      models: modelsForProviderUi(id, defaultModel),
    });
  }
  res.json({
    ok: true,
    autoOrder: ["claude", "grok", "gemini", "openai"].filter((p) => keys[p]),
    providers,
  });
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

function isDevAuthorized(req) {
  if (!config.apiAuthToken) return { ok: false, status: 503, error: "API_AUTH_TOKEN not configured" };
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
  if (bearer === config.apiAuthToken || xKey === config.apiAuthToken) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized developer mode" };
}

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
  } = req.body || {};
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
    const auth = isDevAuthorized(req);
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

  /** Process buffered text: emit text events, extract ACTION_JSON directives. Returns leftover tail. */
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
    } else {
      send({ type: "text", delta: trimmed });
      visibleAssistantText += trimmed;
    }
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Always use KB — not just devMode
  const trainingExamples = findRelevantExamples(lastUserMessage, { limit: 5 });
  if (devMode) {
    send({ type: "kb_match", count: trainingExamples.length, examples: trainingExamples.map((e) => ({ id: e.id, category: e.category, score: e.matchScore })) });
  }

  // Extract last 3 assistant openings for anti-repetition guidance
  const recentAssistantMessages = messages
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .map((m) => String(m.content || "").slice(0, 120));

  const systemPrompt = buildSystemPrompt(calcState, { trainingExamples, devMode, recentAssistantMessages });

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

  let truncationNoticeSent = false;
  for (const provider of providerChain) {
    try {
      // Reset per-attempt accumulators so a mid-stream failure doesn't contaminate the next provider's log entry
      visibleAssistantText = "";
      emittedActions.length = 0;
      let buf = "";
      let resolvedModel = "";

      const useRequestedModel = pref !== "auto" && prefOk && provider === pref;
      const requestedId = useRequestedModel ? aiModel : "";

      if (provider === "claude") {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const model = resolveModelForProvider("claude", requestedId, modelDefaults.claude);
        resolvedModel = model;
        const maxOutputTokens = thinkingMode ? 4096 : CHAT_MAX_TOKENS;
        const { messages: msgs, truncated } = truncateHistoryToBudget(
          filteredMsgs,
          effectiveSystemPrompt,
          getTokenBudgetForModel({ modelId: model, requestedOutputTokens: maxOutputTokens })
        );
        if (truncated && !truncationNoticeSent) {
          send({ type: "info", message: "Se truncó el historial para mantener la calidad de la respuesta." });
          truncationNoticeSent = true;
        }
        const claudeOpts = {
          model,
          max_tokens: maxOutputTokens,
          system: effectiveSystemPrompt,
          messages: msgs,
        };
        if (thinkingMode) {
          claudeOpts.thinking = { type: "enabled", budget_tokens: 2048 };
          send({ type: "thinking_start" });
        }
        const stream = anthropic.messages.stream(claudeOpts);
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta?.type === "text_delta" &&
            chunk.delta.text
          ) {
            buf += chunk.delta.text;
            buf = flushLines(buf);
          }
        }
        if (thinkingMode) send({ type: "thinking_done" });
      } else if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = resolveModelForProvider("gemini", requestedId, modelDefaults.gemini);
        resolvedModel = model;
        const { messages: msgs, truncated } = truncateHistoryToBudget(
          filteredMsgs,
          effectiveSystemPrompt,
          getTokenBudgetForModel({ modelId: model })
        );
        if (truncated && !truncationNoticeSent) {
          send({ type: "info", message: "Se truncó el historial para mantener la calidad de la respuesta." });
          truncationNoticeSent = true;
        }
        const geminiModel = genAI.getGenerativeModel({ model });
        const geminiMessages = msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const result = await geminiModel.generateContentStream({
          contents: geminiMessages,
          systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
        });
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            buf += text;
            buf = flushLines(buf);
          }
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
        const { messages: msgs, truncated } = truncateHistoryToBudget(
          filteredMsgs,
          effectiveSystemPrompt,
          getTokenBudgetForModel({ modelId: model, requestedOutputTokens: CHAT_MAX_TOKENS })
        );
        if (truncated && !truncationNoticeSent) {
          send({ type: "info", message: "Se truncó el historial para mantener la calidad de la respuesta." });
          truncationNoticeSent = true;
        }

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

        // Log assistant turn (include per-turn hedgeCount so buildConversationFromEvents can sum)
        if (conversationId) {
          logConversationTurn(conversationId, {
            turnIndex: assistantTurnIndex,
            role: "assistant",
            content: visibleAssistantText,
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
