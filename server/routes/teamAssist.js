// ═══════════════════════════════════════════════════════════════════════════
// server/routes/teamAssist.js — Chat “equipo” para simulacro / asistencia.
// Multi-provider: usa la misma cadena de fallback que el resto del server
// (claude → grok → gemini → openai → openrouter) vía callAiCompletion.
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { callAiCompletion } from "../lib/aiCompletion.js";
import { getApiKey, getProviderChain } from "../lib/aiProviderConfig.js";
import { clientIpKey } from "../lib/rateLimitKeys.js";

const router = Router();

/** Phase A (S5): public simulacro — rate limit instead of API_AUTH_TOKEN. */
export const TEAM_ASSIST_CHAT_RATE = {
  windowMs: Number(process.env.TEAM_ASSIST_RATE_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.TEAM_ASSIST_RATE_MAX || 20),
};

/** @deprecated use clientIpKey — exported for regression tests */
export function teamAssistClientKey(req) {
  return clientIpKey(req);
}

const chatLimiter = rateLimit({
  windowMs: TEAM_ASSIST_CHAT_RATE.windowMs,
  max: TEAM_ASSIST_CHAT_RATE.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Bug DP: never key on raw X-Forwarded-For first hop (client-spoofable).
  keyGenerator: clientIpKey,
  validate: { keyGeneratorIpFallback: false },
  message: {
    ok: false,
    error: "Demasiadas solicitudes al asistente. Esperá unos minutos e intentá de nuevo.",
  },
});

/** Roles alineados conceptualmente a PROJECT-TEAM-FULL-COVERAGE (§2) — prompts cortos */
export const TEAM_ASSIST_AGENTS = [
  {
    id: "orchestrator",
    label: "Orquestador",
    short: "Coordina, prioriza y pide solo lo necesario.",
    skillHint: "Coordinación, handoffs, orden de trabajo",
  },
  {
    id: "analyst",
    label: "Análisis e información",
    short: "Fragmenta y ordena la información que tirás encima.",
    skillHint: "Clarificar datos, estructurar requerimientos",
  },
  {
    id: "calc",
    label: "Presupuestación / Calc",
    short: "Técnico de cotización: escenarios, BOM, listas, márgenes.",
    skillHint: "Calculadora BMC, paneles, cotización",
  },
  {
    id: "sheets",
    label: "Planillas / Sheets",
    short: "Mapeo a Google Sheets: tabs, columnas, flujos (sin inventar IDs).",
    skillHint: "Sheets, CRM_Operativo, Master_Cotizaciones",
  },
];

const AGENT_INSTRUCTIONS = {
  orchestrator: `Rol: Orquestador del equipo BMC/Panelin. Desglosá la tarea en pasos, asigná qué falta a cada área (calc, sheets, etc.) y formulá preguntas mínimas al usuario. No hagas cálculos numéricos finos: derivá al rol Calc si hace falta.`,
  analyst: `Rol: Análisis de información. Reorganizá lo que el usuario escribió en bullets, destacá ambigüedades, datos faltantes y riesgos. No inventes medidas ni precios.`,
  calc: `Rol: Especialista en presupuestación técnica (Calculadora BMC). Explicá escenarios (techo/fachada/cámara), listas venta/web, BOM, IVA, autoportancia. Si no tenés números exactos, decí que hay que correr la calculadora o confirmar en matriz. Nunca afirmes precios como definitivos sin esa aclaración.`,
  sheets: `Rol: Planillas y Google Sheets del proyecto. Explicá en términos de tabs, columnas y flujos según la documentación típica del repo (sin inventar sheet IDs). Si el usuario pide “cargar planilla”, describí qué campos conviene completar y en qué orden; recordá que credenciales y edición estructural la define el operador.`,
};

function configuredAiProviders() {
  return getProviderChain().filter((p) => Boolean(getApiKey(p)));
}

function requireAiConfigured(req, res, next) {
  if (configuredAiProviders().length === 0) {
    return res.status(503).json({
      ok: false,
      error: "Ninguna API key de IA configurada en el servidor",
      hint: "Agregá al menos una de ANTHROPIC_API_KEY / GROK_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY al .env y reiniciá npm run start:api",
    });
  }
  next();
}

const MSG_LIMIT = 8;
const MSG_CHAR_LIMIT = 4000;
const TOTAL_CHAR_BUDGET = 32000;

function clampMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const sliced = messages.slice(-MSG_LIMIT);
  const clamped = [];
  let totalChars = 0;
  for (const m of sliced) {
    const content = String(m.content ?? "").slice(0, MSG_CHAR_LIMIT);
    if (totalChars + content.length > TOTAL_CHAR_BUDGET) break;
    totalChars += content.length;
    clamped.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content,
    });
  }
  return clamped;
}

function buildSystemPrompt(agentId, context) {
  const agent = TEAM_ASSIST_AGENTS.find((a) => a.id === agentId) || TEAM_ASSIST_AGENTS[0];
  const roleText = AGENT_INSTRUCTIONS[agentId] || AGENT_INSTRUCTIONS.orchestrator;
  const ctx =
    context && typeof context === "object"
      ? JSON.stringify(context, null, 0).slice(0, 12000)
      : "{}";
  return `Sos el asistente "${agent.label}" del equipo BMC Uruguay / Panelin (paneles aislantes, Uruguay).
${roleText}

Reglas globales:
- Respondé en español (Uruguay / rioplatense), tono profesional y directo.
- Si falta información, preguntá de forma concreta (una o pocas preguntas).
- No inventes IDs de planillas, tokens ni URLs de producción.
- Los precios y SKUs son orientativos salvo que vengan de datos explícitos del usuario o del contexto JSON.

Contexto JSON del simulacro de especificaciones (puede estar vacío o parcial):
${ctx}`;
}

router.get("/health", (req, res) => {
  const providers = configuredAiProviders();
  res.json({
    ok: true,
    ai_configured: providers.length > 0,
    providers,
    // Deprecated alias (era literal "hay key de OpenAI"); ahora significa
    // "hay algún provider IA usable". Mantener hasta migrar consumidores.
    openai_configured: providers.length > 0,
    model: providers[0] || null,
    auth_required: false,
    rate_limit: {
      window_ms: TEAM_ASSIST_CHAT_RATE.windowMs,
      max_per_window: TEAM_ASSIST_CHAT_RATE.max,
    },
  });
});

router.get("/agents", (req, res) => {
  res.json({ ok: true, agents: TEAM_ASSIST_AGENTS });
});

router.post("/chat", chatLimiter, requireAiConfigured, async (req, res) => {
  const agentId = String(req.body?.agentId || "orchestrator");
  const messages = clampMessages(req.body?.messages);
  const context = req.body?.context;

  if (messages.length === 0) {
    return res.status(400).json({ ok: false, error: "messages[] requerido" });
  }

  const system = buildSystemPrompt(agentId, context);

  // callAiCompletion acepta un solo turno de usuario: aplanar el historial
  // clampeado (máx 8 mensajes / 32k chars) en una transcripción etiquetada.
  const transcript = messages
    .map((m) => `${m.role === "assistant" ? "Asistente" : "Usuario"}: ${m.content}`)
    .join("\n\n");

  try {
    const { text, provider } = await callAiCompletion({
      systemPrompt: system,
      userMessage: transcript,
      maxTokens: 4096,
    });

    if (!text) {
      return res.status(502).json({ ok: false, error: "Respuesta vacía del modelo" });
    }

    return res.json({
      ok: true,
      reply: text,
      model: provider,
      provider,
      agentId,
    });
  } catch (err) {
    req.log?.error?.({ err, details: err?.details }, "teamAssist AI chain failed");
    return res.status(503).json({
      ok: false,
      error: "Ningún proveedor de IA respondió. Intentá de nuevo en unos minutos.",
    });
  }
});

export default router;
