// ═══════════════════════════════════════════════════════════════════════════
// server/routes/teamAssist.js — Chat “equipo” para simulacro / asistencia (OpenAI)
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { config } from "../config.js";

const router = Router();

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

function requireOpenAI(req, res, next) {
  if (!config.openaiApiKey) {
    return res.status(503).json({
      ok: false,
      error: "OPENAI_API_KEY no configurada en el servidor",
      hint: "Agregá OPENAI_API_KEY al .env y reiniciá npm run start:api",
    });
  }
  const expected = config.apiAuthToken;
  if (expected) {
    const header =
      req.headers["x-api-key"] ||
      (req.headers.authorization && String(req.headers.authorization).replace(/^Bearer\s+/i, ""));
    if (String(header || "") !== String(expected)) {
      return res.status(401).json({ ok: false, error: "API key inválida o ausente (x-api-key)" });
    }
  }
  next();
}

function clampMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const max = 32;
  const sliced = messages.slice(-max);
  return sliced.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? "").slice(0, 24000),
  }));
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
  res.json({
    ok: true,
    openai_configured: Boolean(config.openaiApiKey),
    model: config.openaiChatModel,
    auth_required: Boolean(config.apiAuthToken),
  });
});

router.get("/agents", (req, res) => {
  res.json({ ok: true, agents: TEAM_ASSIST_AGENTS });
});

router.post("/chat", requireOpenAI, async (req, res) => {
  const agentId = String(req.body?.agentId || "orchestrator");
  const messages = clampMessages(req.body?.messages);
  const context = req.body?.context;

  if (messages.length === 0) {
    return res.status(400).json({ ok: false, error: "messages[] requerido" });
  }

  const system = buildSystemPrompt(agentId, context);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiChatModel,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.5,
        max_tokens: 4096,
      }),
    });

    const raw = await r.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      req.log?.error?.({ raw: raw.slice(0, 500) }, "teamAssist OpenAI non-JSON");
      return res.status(502).json({ ok: false, error: "Respuesta inválida del proveedor IA" });
    }

    if (!r.ok) {
      const msg = data?.error?.message || raw.slice(0, 300);
      req.log?.warn?.({ status: r.status, msg }, "teamAssist OpenAI error");
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({
        ok: false,
        error: msg,
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) {
      return res.status(502).json({ ok: false, error: "Respuesta vacía del modelo" });
    }

    return res.json({
      ok: true,
      reply,
      model: data?.model || config.openaiChatModel,
      agentId,
    });
  } catch (err) {
    req.log?.error?.({ err }, "teamAssist fetch failed");
    return res.status(503).json({ ok: false, error: err.message || "Error al contactar OpenAI" });
  }
});

export default router;
