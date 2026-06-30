/**
 * emailAgentChat.js — in-app "Asistente de Correos BMC" (right-side chat panel).
 *
 * A second, specialized agent persona docked in the calculadora. It manages the
 * BMC shared email inbox conversationally: draft, edit, reply, report, reuse
 * templates, triage and organize — by calling Chatwoot via the email tools.
 *
 * - Auth: operator-only (Identity JWT with `canales:write`, via requireCrmCockpitWrite).
 * - Streaming: SSE (text/event-stream), same shape as agentChat.js.
 * - Tool loop: Anthropic tool-use (self-contained email tools; max 6 rounds).
 * - Send/assign tools require user_confirmed — the agent never auto-sends.
 * - Boot-safe: if Chatwoot/Anthropic unconfigured, returns a clean SSE error,
 *   never crashes the app.
 *
 * Mounted in server/index.js: app.use("/api", createEmailAgentRouter(config, logger))
 * Endpoint: POST /api/email-agent/chat
 */

import { Router } from "express";
import { requireCrmCockpitWrite } from "../middleware/requireCrmCockpitAuth.js";
import { isChatwootConfigured } from "../lib/chatwootClient.js";
import { EMAIL_AGENT_TOOLS, executeEmailTool } from "../lib/emailAgentTools.js";
import { resolveModel, getApiKey } from "../lib/aiProviderConfig.js";

const MAX_ROUNDS = 6;

const SYSTEM_PROMPT = `Sos el Asistente de Correos de BMC Uruguay (paneles de aislamiento térmico), integrado en la calculadora.
Trabajás SOBRE el buzón compartido de ventas. Tu trabajo: ayudar al operador a triar, redactar, editar, responder, reportar, reutilizar plantillas y organizar emails de clientes.

Idioma: español rioplatense, tono profesional y cálido de ventas BMC. Money en USD, sin IVA salvo aclaración.

Reglas duras:
- NUNCA envíes una respuesta al cliente sin que el operador confirme. La tool email_enviar_respuesta exige user_confirmed:true; si no lo tenés, primero mostrá el borrador y pedí confirmación explícita.
- Lo mismo para asignar (email_asignar).
- Para reportes/triage usá email_listar_conversaciones y email_reporte.
- Antes de redactar, leé el hilo con email_leer_conversacion.
- Sé conciso. Mostrá ids de conversación cuando listes.
- Si una acción falla por "chatwoot_not_configured", avisá que el buzón aún no está conectado.`;

/** Build the drafter used by email_redactar_respuesta (one provider-chain call). */
function makeDrafter(config) {
  return async ({ instruccion, thread }) => {
    const apiKey = config.anthropicApiKey || getApiKey("claude");
    if (!apiKey) return "(sin proveedor de IA configurado para redactar)";
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });
    const model = resolveModel("claude", undefined, true);
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 600,
      system:
        "Redactás respuestas de ventas para BMC Uruguay (paneles de aislamiento). Español, tono BMC, claro y concreto. Devolvé SOLO el cuerpo del email, sin asunto ni firma duplicada.",
      messages: [
        {
          role: "user",
          content: `Email del cliente:\nDe: ${thread?.remitente || "—"}\nAsunto: ${thread?.asunto || "—"}\n\n${thread?.cuerpo || ""}\n\nInstrucción del operador: ${instruccion || "Responder de forma útil avanzando hacia la cotización."}`,
        },
      ],
    });
    return msg.content?.[0]?.text || "(borrador vacío)";
  };
}

export default function createEmailAgentRouter(config = {}, logger = null) {
  const router = Router();

  router.get("/email-agent/health", (_req, res) => {
    res.json({
      ok: true,
      chatwootConfigured: isChatwootConfigured(),
      hasAnthropic: Boolean(config.anthropicApiKey || getApiKey("claude")),
      tools: EMAIL_AGENT_TOOLS.map((t) => t.name),
    });
  });

  router.post("/email-agent/chat", requireCrmCockpitWrite, async (req, res) => {
    const { messages = [] } = req.body || {};

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    let aborted = false;
    req.on("close", () => { aborted = true; });
    const send = (obj) => { if (!aborted) res.write(`data: ${JSON.stringify(obj)}\n\n`); };
    const end = () => { if (!aborted) { res.write("data: [DONE]\n\n"); res.end(); } };

    const apiKey = config.anthropicApiKey || getApiKey("claude");
    if (!apiKey) {
      send({ type: "error", error: "no_ai_provider" });
      return end();
    }
    if (!isChatwootConfigured()) {
      send({ type: "warning", warning: "chatwoot_not_configured", message: "El buzón compartido aún no está conectado. Configurá CHATWOOT_* para habilitar acciones de correo." });
    }

    const drafter = makeDrafter(config);

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey });
      const model = resolveModel("claude", undefined, false);

      const convo = messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
        .map((m) => ({ role: m.role, content: String(m.content) }));

      let round = 0;
      while (round < MAX_ROUNDS && !aborted) {
        round += 1;
        const resp = await anthropic.messages.create({
          model,
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          tools: EMAIL_AGENT_TOOLS,
          messages: convo,
        });

        // Stream any text blocks.
        const textParts = resp.content.filter((b) => b.type === "text").map((b) => b.text);
        if (textParts.length) send({ type: "text", text: textParts.join("") });

        const toolUses = resp.content.filter((b) => b.type === "tool_use");
        if (toolUses.length === 0) {
          break; // model finished
        }

        // Push assistant turn, then run tools and feed results back.
        convo.push({ role: "assistant", content: resp.content });
        const toolResults = [];
        for (const tu of toolUses) {
          send({ type: "tool_call", name: tu.name, input: tu.input });
          const result = await executeEmailTool(tu.name, tu.input || {}, { drafter });
          send({ type: "tool_result", name: tu.name, ok: result.ok !== false });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(result).slice(0, 6000),
          });
        }
        convo.push({ role: "user", content: toolResults });
      }
      end();
    } catch (e) {
      logger?.error?.({ err: String(e?.message || e) }, "email-agent: loop error");
      send({ type: "error", error: String(e?.message || e).slice(0, 200) });
      end();
    }
  });

  return router;
}
