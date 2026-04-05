/**
 * POST /api/agent/chat — SSE streaming endpoint for the Panelin AI agent.
 *
 * Provider chain: claude → grok → gemini → openai (first available key wins; falls through on error).
 *
 * Request:  { messages: [{role, content}], calcState: {...} }
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

const router = Router();

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
  const { messages = [], calcState = {}, devMode = false } = req.body || {};

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

  // 1.5 — Abort LLM stream on client disconnect
  const disconnectController = new AbortController();
  req.on("close", () => {
    aborted = true;
    disconnectController.abort();
  });

  // 1.4 — SSE keepalive heartbeat every 15s to prevent proxy timeouts
  const heartbeat = setInterval(() => { if (!aborted) res.write(":\n\n"); }, 15000);

  /** Process buffered text: emit text events, extract ACTION_JSON directives. Returns leftover tail. */
  function flushLines(buf) {
    const lines = buf.split("\n");
    const tail = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ACTION_JSON:")) {
        try {
          const action = JSON.parse(trimmed.slice("ACTION_JSON:".length).trim());
          // 0.4 — Only emit validated action types
          if (VALID_ACTION_TYPES.has(action.type)) {
            send({ type: "action", action });
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
        // 0.4 — Only emit validated action types
        if (VALID_ACTION_TYPES.has(action.type)) {
          send({ type: "action", action });
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
  const trainingExamples = devMode ? findRelevantExamples(lastUserMessage, { limit: 5 }) : [];
  if (devMode) {
    send({ type: "kb_match", count: trainingExamples.length, examples: trainingExamples.map((e) => ({ id: e.id, category: e.category, score: e.matchScore })) });
  }
  const systemPrompt = buildSystemPrompt(calcState, { trainingExamples, devMode });
  let filteredMsgs = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));

  // 1.7 — Truncate history to stay within ~8000 token budget (rough: chars/4)
  const SYSTEM_ESTIMATE = Math.ceil(systemPrompt.length / 4);
  const TOKEN_BUDGET = 8000;
  let tokenSum = SYSTEM_ESTIMATE;
  const truncated = [];
  for (let i = filteredMsgs.length - 1; i >= 0; i--) {
    const t = Math.ceil(filteredMsgs[i].content.length / 4) + 5;
    if (tokenSum + t > TOKEN_BUDGET && truncated.length >= 2) break;
    tokenSum += t;
    truncated.unshift(filteredMsgs[i]);
  }
  if (truncated.length < filteredMsgs.length) {
    send({ type: "info", message: "Se resumió el historial para mantener la calidad de la respuesta." });
  }
  const msgs = truncated;

  const providerChain = [];
  if (hasAnthropic) providerChain.push("claude");
  if (hasGrok)      providerChain.push("grok");
  if (hasGemini)    providerChain.push("gemini");
  if (hasOpenAI)    providerChain.push("openai");

  for (const provider of providerChain) {
    try {
      let buf = "";

      if (provider === "claude") {
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
        const stream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages: msgs,
        });
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
      } else if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const geminiMessages = msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const result = await geminiModel.generateContentStream({
          contents: geminiMessages,
          systemInstruction: { parts: [{ text: systemPrompt }] },
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
        const model = provider === "grok" ? "grok-3-mini" : "gpt-4o-mini";

        const stream = await client.chat.completions.create({
          model,
          max_tokens: 1024,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...msgs],
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
        if (devMode) {
          const validation = buildCalcValidation(calcState, visibleAssistantText);
          send({ type: "calc_validation", validation });
          appendTrainingSessionEvent({
            type: "chat_turn",
            mode: "developer",
            provider,
            kbMatches: trainingExamples.length,
            question: String(lastUserMessage || "").slice(0, 500),
            calcValidation: validation,
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
