#!/usr/bin/env node
/**
 * Idempotent apply — Panelin Co-Work session analysis Wave 1–3.
 * Run from repo root: node scripts/apply-panelin-cowork-w1-w3.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
}

function patch(rel, fn) {
  const before = read(rel);
  const after = fn(before);
  if (after !== before) {
    write(rel, after);
    console.log("patched", rel);
  } else {
    console.log("skip (ok)", rel);
  }
}

// ── useChat.js ───────────────────────────────────────────────────────────────
patch("src/hooks/useChat.js", (s) => {
  if (!s.includes("export function stripHistoryNoise")) {
    s = s.replace(
      "}\n\n\n/**\n * Build the JSON body posted to POST /api/agent/chat",
      `}\n\n\n/** Strip Co-Work / truncate info notes from message text before sending as API history. */\nexport function stripHistoryNoise(content) {\n  const lines = String(content || "").split("\\n");\n  return lines\n    .filter((line) => {\n      const t = line.trim();\n      if (!t) return true;\n      if (/^_(.+)_$/.test(t)) return false;\n      if (/^⚠️/.test(t)) return false;\n      return true;\n    })\n    .join("\\n")\n    .trim();\n}\n\n/**\n * Build the JSON body posted to POST /api/agent/chat`,
    );
  }
  if (!s.includes("stripHistoryNoise(m.content)")) {
    s = s.replace(
      "const base = { role: m.role, content: m.content };",
      "const base = { role: m.role, content: stripHistoryNoise(m.content) };",
    );
  }
  if (s.includes("content: m.content\n                              ? (m.content.includes(note)")) {
    s = s.replace(
      `              } else if (evt.type === "info") {
                // Provider failover / Co-Work notes — surface under the streaming bubble
                const note = String(evt.message || "").trim();
                if (note) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            // Keep pending=true while still streaming so we show activity,
                            // but surface the note as status text so the bubble is not empty.
                            content: m.content
                              ? (m.content.includes(note) ? m.content : \`\${m.content}\\n_\${note}_\`)
                              : \`_\${note}_\`,
                            infoNotes: [...(m.infoNotes || []), note],
                          }
                        : m
                    )
                  );
                }
              }`,
      `              } else if (evt.type === "info") {
                const note = String(evt.message || "").trim();
                if (note) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, infoNotes: [...(m.infoNotes || []), note] }
                        : m
                    )
                  );
                }
              } else if (evt.type === "provider_reset") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: "", infoNotes: [], pending: true }
                      : m
                  )
                );
              }`,
    );
  } else if (!s.includes('evt.type === "provider_reset"')) {
    s = s.replace(
      `              } else if (evt.type === "cowork_ack") {`,
      `              } else if (evt.type === "provider_reset") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: "", infoNotes: [], pending: true }
                      : m
                  )
                );
              } else if (evt.type === "cowork_ack") {`,
    );
  }
  if (!s.includes("err._body")) {
    s = s.replace(
      `        if (!res.ok) {
          const err = new Error(\`HTTP \${res.status}\`);
          err._status = res.status;
          throw err;
        }`,
      `        if (!res.ok) {
          let body = null;
          try { body = await res.json(); } catch { /* ignore */ }
          const err = new Error(body?.error || \`HTTP \${res.status}\`);
          err._status = res.status;
          err._body = body;
          err._serverMessage = body?.error || "";
          throw err;
        }`,
    );
  }
  return s;
});

// ── chatErrors.js ──────────────────────────────────────────────────────────
patch("src/utils/chatErrors.js", (s) => {
  if (s.includes("_serverMessage")) return s;
  return `/**
 * Maps fetch/HTTP errors to user-friendly Spanish messages for the chat UI.
 * Extracted as a standalone module so it can be unit-tested without React.
 */
export function mapErrorMessage(err) {
  if (err?.name === "AbortError") return null; // intentional stop()
  const status = err?._status;
  const serverMsg = String(err?._serverMessage || err?._body?.error || "").trim();
  if (status === 401) {
    return "Token de desarrollador inválido. Tiene que ser el mismo valor que API_AUTH_TOKEN en la API (Cloud Run): sin comillas, espacios ni líneas al pegar. Si cambió el token en el servidor, actualizalo con Ctrl+Shift+D de nuevo.";
  }
  if (status === 403) return "Origen no permitido para este servicio.";
  if (status === 429) return "Demasiadas consultas. Esperá un momento.";
  if (status === 503) return "Servicio de IA no disponible en este momento.";
  if (status === 400 && /historial demasiado largo/i.test(serverMsg)) {
    return "El historial del chat superó 60 mensajes. Usá «Limpiar chat» (icono papelera) y volvé a enviar tu consulta.";
  }
  if (status === 400 && serverMsg) return serverMsg;
  if (status >= 500) return \`Error del servidor (\${status}). Intentá de nuevo.\`;
  if (err instanceof TypeError || status === 0) {
    return "No se puede conectar con el servidor. Verificá tu conexión.";
  }
  if (status) return \`Error \${status}. Intentá de nuevo.\`;
  return "No se pudo conectar con Panelin. Intentá de nuevo.";
}
`;
});

// ── chatSummarizer.js ──────────────────────────────────────────────────────
patch("server/lib/chatSummarizer.js", (s) =>
  s.replace(/const KEEP_RECENT = 4;/, "const KEEP_RECENT = 6;"),
);

// ── coworkFrames.js ────────────────────────────────────────────────────────
patch("server/lib/coworkFrames.js", (s) => {
  if (s.includes("operatorContext.defaults")) return s;
  return s.replace(
    `  if (operatorContext.liveAssist) lines.push("- Live assist: ON (la imagen adjunta es la captura más reciente de la pestaña compartida)");
  lines.push("- La imagen es HINT visual; verificá números y filas con tools sheets_* / wolfboard_* antes de cotizar o escribir.");
  return lines.join("\\n");`,
    `  if (operatorContext.liveAssist) lines.push("- Live assist: ON (la imagen adjunta es la captura más reciente de la pestaña compartida)");
  const d = operatorContext.defaults && typeof operatorContext.defaults === "object" ? operatorContext.defaults : null;
  if (d) {
    lines.push("- Defaults operador (usá salvo corrección explícita):");
    if (d.listaPrecios) lines.push(\`  · Lista precios: \${d.listaPrecios}\`);
    if (d.aguasTecho != null) lines.push(\`  · Aguas techo: \${d.aguasTecho}\`);
    if (d.crmFaltaInfoPrefix) lines.push(\`  · Prefijo falta-info CRM: "\${d.crmFaltaInfoPrefix}"\`);
    lines.push("  · Lead WA sin fila Admin → \`wa_lead_to_admin\` (no inventes rowNum).");
  }
  lines.push("- La imagen es HINT visual; verificá números y filas con tools sheets_* / wolfboard_* antes de cotizar o escribir.");
  return lines.join("\\n");`,
  );
});

// ── chatPrompts.js ─────────────────────────────────────────────────────────
patch("server/lib/chatPrompts.js", (s) => {
  if (!s.includes("learningBmcBlock")) {
    s = s.replace(
      `  const antiRepBlock = ANTI_REPETITION_RULES;`,
      `  const learningBmcBlock = \`## CÓMO APRENDO (BMC — honestidad operativa)
- **No** entreno modelos de Google/OpenAI con tus chats. El aprendizaje operativo es **Training KB** interna (Good/Correct en modo dev, entradas curadas).
- Si el operador corrige algo, orientalo a **Good/Correct** o a escribir en la KB — no prometas "aprendizaje automático" externo.
- Co-Work Live: solo **JPEG read-only** de la pestaña compartida — **no** controlás mouse/teclado ni WhatsApp Web DOM.\`;

  const antiRepBlock = ANTI_REPETITION_RULES;`,
    );
  }
  if (!s.includes("WhatsApp Web (JPEG read-only)")) {
    s = s.replace(
      `  const coworkVisionBlock = \`## Co-Work / visión (pantalla + planillas)
- Las capturas de pantalla del operador son **CONTEXTO**, no fuente de verdad de números ni rowNum.
- Antes de cotizar o escribir: verificá filas/celdas con \\\`sheets_read_range\\\`, \\\`sheets_find\\\`, \\\`sheets_get_pending_admin\\\` o tools wolfboard_*.
- Nunca inventes un rowNum: si no está claro en el texto ni en la captura, preguntá o usá \\\`sheets_find\\\`.
- Escrituras: proponé el cambio (\\\`sheets_propose_write\\\` o describí el diff) y esperá confirmación explícita antes de \\\`sheets_write_range\\\` / \\\`wolfboard_actualizar_fila\\\` / \\\`guardar_en_crm\\\`.
- Live assist: la imagen adjunta es la captura más reciente de la pestaña compartida; no repitas el mismo resumen si no hay pedido nuevo del operador.
- Preferí workbook alias \\\`admin\\\` o \\\`crm\\\` — no pidas spreadsheet IDs al operador.\`;`,
      `  const coworkVisionBlock = \`## Co-Work / visión (pantalla + planillas)
- Las capturas del operador son **CONTEXTO OCR** — no fuente de verdad de números ni rowNum.
- **WhatsApp Web (JPEG read-only):** podés leer texto visible en la captura; **NO** abrís chats, **NO** clickeás, **NO** escribís en WA Web. Para crear lead en Admin usá \\\`wa_lead_to_admin\\\` (confirmación explícita).
- Checklist WA lead: extraé consulta + teléfono + nombre si aparecen; si falta algo, listalo en campos_faltantes — no inventes.
- Antes de cotizar o escribir: verificá filas/celdas con \\\`sheets_read_range\\\`, \\\`sheets_find\\\`, \\\`sheets_get_pending_admin\\\` o tools wolfboard_*.
- Consulta **nueva** sin fila Admin: \\\`wa_lead_to_admin\\\` — **no** pidas rowNum Wolfboard que aún no existe.
- Nunca inventes un rowNum: si no está claro, preguntá o usá \\\`sheets_find\\\`.
- Escrituras: proponé el cambio y esperá confirmación explícita antes de \\\`sheets_write_range\\\` / \\\`wolfboard_actualizar_fila\\\` / \\\`guardar_en_crm\\\` / \\\`wa_lead_to_admin\\\`.
- Live assist: imagen = captura más reciente; no repitas el mismo resumen sin pedido nuevo.
- Preferí workbook alias \\\`admin\\\` o \\\`crm\\\` — no pidas spreadsheet IDs al operador.
- **Babeta adosar:** desarrollo **16 cm** (plegados incluidos); largo comercial de pieza ~**3 m** — no confundas desarrollo con largo de tramo.\`;`,
    );
  }
  if (!s.includes("wa_lead_to_admin")) {
    s = s.replace(
      `- \\\`wolfboard_pendientes\\\` — lista filas pendientes del Admin 2.0`,
      `- \\\`wa_lead_to_admin\\\` — **crea fila nueva** en Admin para lead WA/otro canal sin fila existente. Pasá consulta (obligatorio), telefono, cliente, origen (WA/CL/LL/LO/FB/IG), zona, campos_faltantes. REQUIERE user_confirmed=true.
- \\\`wolfboard_pendientes\\\` — lista filas pendientes del Admin 2.0`,
    );
  }
  if (!s.includes("learningBmcBlock, coworkVisionBlock")) {
    s = s.replace(
      "canonicalPrices, knowledgeBlock, brainBlockStr, coworkVisionBlock, toolsBlock",
      "canonicalPrices, knowledgeBlock, brainBlockStr, learningBmcBlock, coworkVisionBlock, toolsBlock",
    );
  }
  return s;
});

// ── agentTools.js ──────────────────────────────────────────────────────────
patch("server/lib/agentTools.js", (s) => {
  if (!s.includes('name: "wa_lead_to_admin"')) {
    s = s.replace(
      `  // ─── Wolfboard Hub (admin cotizaciones management) ─────────────────────────

  {
    name: "wolfboard_pendientes",`,
      `  // ─── Wolfboard Hub (admin cotizaciones management) ─────────────────────────

  {
    name: "wa_lead_to_admin",
    description:
      "Crea una fila nueva en Admin 2.0 para un lead (WhatsApp u otro canal) cuando NO existe fila. " +
      "Pasá consulta (obligatorio), telefono, cliente, origen (WA/CL/LL/LO/FB/IG), zona, campos_faltantes. " +
      "REQUIERE user_confirmed=true (ej. cargalo en Admin / creá la consulta / guardalo en Wolfboard).",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Texto de la consulta del cliente (col I)" },
        telefono: { type: "string" },
        cliente: { type: "string" },
        origen: { type: "string", description: "WA, CL, LL, LO, FB, IG — default WA" },
        zona: { type: "string" },
        campos_faltantes: { type: "string", description: "Qué falta pedir al cliente" },
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true." },
      },
      required: ["consulta", "user_confirmed"],
    },
  },

  {
    name: "wolfboard_pendientes",`,
    );
  }
  if (!s.includes("export function buildWaLeadAdminNotas")) {
    s = s.replace(
      `export async function executeTool(name, input = {}, calcState = {}, opts = {}) {`,
      `export function buildWaLeadAdminNotas(input = {}, operatorContext = null) {
  const d = operatorContext?.defaults && typeof operatorContext.defaults === "object" ? operatorContext.defaults : {};
  const parts = [];
  if (d.listaPrecios) parts.push(\`lista=\${d.listaPrecios}\`);
  if (d.aguasTecho != null) parts.push(\`aguas_techo=\${d.aguasTecho}\`);
  if (d.crmFaltaInfoPrefix && input?.campos_faltantes) {
    parts.push(\`\${d.crmFaltaInfoPrefix} \${String(input.campos_faltantes).trim()}\`);
  } else if (input?.campos_faltantes) {
    parts.push(String(input.campos_faltantes).trim());
  }
  return parts.filter(Boolean).join(" · ");
}

export async function executeTool(name, input = {}, calcState = {}, opts = {}) {`,
    );
  }
  if (!s.includes('if (name === "wa_lead_to_admin")')) {
    s = s.replace(
      `    if (name === "wolfboard_pendientes" || name === "wolfboard_export") {`,
      `    if (name === "wa_lead_to_admin") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const consulta = String(input?.consulta ?? "").trim();
      if (!consulta) return JSON.stringify({ ok: false, error: "consulta requerida" });
      const notas = buildWaLeadAdminNotas(input, opts?.operatorContext);
      const body = {
        consulta,
        telefono: input?.telefono != null ? String(input.telefono) : "",
        cliente: input?.cliente != null ? String(input.cliente) : "",
        origen: input?.origen != null ? String(input.origen) : "WA",
        zona: input?.zona != null ? String(input.zona) : "",
        ...(notas ? { notas } : {}),
      };
      return await wolfboardForward("/api/wolfboard/row-create", { method: "POST", body }, name);
    }

    if (name === "wolfboard_pendientes" || name === "wolfboard_export") {`,
    );
  }
  return s;
});

// ── agentChat.js ───────────────────────────────────────────────────────────
patch("server/routes/agentChat.js", (s) => {
  if (!s.includes('"wa_lead_to_admin"')) {
    s = s.replace(
      `  "wolfboard_pendientes",`,
      `  "wa_lead_to_admin",
  "wolfboard_pendientes",`,
    );
  }
  if (!s.includes("operatorContext: rawOperatorContext")) {
    s = s.replace(
      `{ emitAction, approvedActions, logger: req.log, callerAuthToken: bearerFromRequest(req) || null }`,
      `{ emitAction, approvedActions, logger: req.log, callerAuthToken: bearerFromRequest(req) || null, operatorContext: rawOperatorContext }`,
    );
  }
  if (!s.includes('type: "provider_reset"')) {
    s = s.replace(
      `      send({ type: "info", message: \`Usando \${provider}…\` });`,
      `      if (provider !== providerChain[0]) {
        send({ type: "provider_reset" });
      }
      send({ type: "info", message: \`Usando \${provider}…\` });`,
    );
    s = s.replace(
      `      if (!aborted) {
        send({ type: "info", message: humanProviderFailHint(provider, errMsg) });
      }
      // Reset visible text so next provider starts clean
      visibleAssistantText = "";`,
      `      if (!aborted) {
        send({ type: "provider_reset" });
        send({ type: "info", message: humanProviderFailHint(provider, errMsg) });
      }
      visibleAssistantText = "";`,
    );
  }
  return s;
});

// ── wolfboard.js ───────────────────────────────────────────────────────────
patch("server/routes/wolfboard.js", (s) => {
  if (s.includes("body.notas")) return s;
  return s.replace(
    `      sanitizeCellValue(consulta),
      "",
      "",`,
    `      sanitizeCellValue(consulta),
      sanitizeCellValue(String(body.notas ?? "")),
      "",`,
  );
});

// ── PanelinChatPanel.jsx ───────────────────────────────────────────────────
patch("src/components/PanelinChatPanel.jsx", (s) => {
  if (!s.includes("crmFaltaInfoPrefix")) {
    s = s.replace(
      `      operatorContext: {
        surface: "panelin_chat",
        liveAssist: liveOn,
        workbook: "admin",
      },`,
      `      operatorContext: {
        surface: "panelin_chat",
        liveAssist: liveOn,
        workbook: "admin",
        defaults: {
          listaPrecios: "venta",
          aguasTecho: 1,
          crmFaltaInfoPrefix: "Falta información de:",
        },
      },`,
    );
  }
  if (!s.includes("msg.infoNotes")) {
    s = s.replace(
      `                  </div>
                  {/* Tool-call indicators (shown in devMode or as subtle pills) */}`,
      `                  </div>
                  {!isUser && Array.isArray(msg.infoNotes) && msg.infoNotes.length > 0 && (
                    <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", paddingLeft: 4 }}>
                      {msg.infoNotes.map((n, i) => (
                        <div key={i}>{n}</div>
                      ))}
                    </div>
                  )}
                  {/* Tool-call indicators (shown in devMode or as subtle pills) */}`,
    );
  }
  return s;
});

// ── tests ──────────────────────────────────────────────────────────────────
write(
  "tests/chatHistoryNoise.test.js",
  `import assert from "node:assert/strict";
import { stripHistoryNoise, buildAgentChatRequestBody } from "../src/hooks/useChat.js";
import { mapErrorMessage } from "../src/utils/chatErrors.js";

assert.equal(
  stripHistoryNoise("Hola\\n_Se truncó el historial para mantener la calidad de la respuesta._\\nRespuesta real"),
  "Hola\\nRespuesta real",
);
assert.equal(stripHistoryNoise("L1\\n\\nL3"), "L1\\n\\nL3");
assert.equal(stripHistoryNoise("_Co-Work: analizando captura…_"), "");

const body = buildAgentChatRequestBody({
  history: [{ role: "assistant", content: "ok\\n_note_" }],
  userText: "x",
  calcState: {},
  operatorContext: { defaults: { listaPrecios: "venta" } },
});
assert.equal(body.messages[0].content, "ok");

const err400 = { _status: 400, _serverMessage: "Historial demasiado largo (máx. 60 mensajes)." };
assert.match(mapErrorMessage(err400), /Limpiar chat/i);

console.log("chatHistoryNoise.test.js OK");
`,
);

write(
  "tests/coworkOperatorContext.test.js",
  `import assert from "node:assert/strict";
import { formatOperatorContextBlock } from "../server/lib/coworkFrames.js";

const b = formatOperatorContextBlock({
  defaults: {
    listaPrecios: "venta",
    aguasTecho: 1,
    crmFaltaInfoPrefix: "Falta información de:",
  },
});
assert.match(b, /wa_lead_to_admin/);
assert.match(b, /venta/);
console.log("coworkOperatorContext.test.js OK");
`,
);

patch("tests/agentTools.test.js", (s) => {
  if (!s.includes('"wa_lead_to_admin"')) {
    s = s.replace(
      `    "wolfboard_pendientes",`,
      `    "wa_lead_to_admin",
    "wolfboard_pendientes",`,
    );
  }
  if (!s.includes('group("wa_lead_to_admin')) {
    s += `\nawait group("wa_lead_to_admin — requires user_confirmed", async () => {
  const { parsed } = await run("wa_lead_to_admin", { consulta: "Babeta galpon" });
  assert(parsed.ok === false, "must reject without user_confirmed");
});\n`;
  }
  return s;
});

patch("tests/toolStats.test.js", (s) =>
  s.replace(
    "assert(AGENT_TOOLS.length === 48, `48 tools exported (got ${AGENT_TOOLS.length})`);",
    "assert(AGENT_TOOLS.length === 49, `49 tools exported (got ${AGENT_TOOLS.length})`);",
  ),
);

patch("package.json", (s) => {
  if (s.includes("chatHistoryNoise.test.js")) return s;
  return s.replace(
    "node tests/liveAssist.test.js && node tests/costTelemetry.test.js",
    "node tests/liveAssist.test.js && node tests/chatHistoryNoise.test.js && node tests/coworkOperatorContext.test.js && node tests/costTelemetry.test.js",
  );
});

// ── docs ───────────────────────────────────────────────────────────────────
const reportSrc = "/tmp/panelin-report.md";
if (fs.existsSync(reportSrc)) {
  fs.mkdirSync(path.join(root, "docs/team/reports"), { recursive: true });
  fs.copyFileSync(reportSrc, path.join(root, "docs/team/reports/PANELIN-SESSION-ANALYSIS-2026-07-20.md"));
  console.log("copied report");
}

patch("docs/team/SDD-PANELIN-COWORK.md", (s) => {
  if (s.includes("Automating WhatsApp Web")) return s;
  return s.replace(
    "- Agent controlling mouse/keyboard  ",
    "- Agent controlling mouse/keyboard  \n- **Automating WhatsApp Web** (open chats, click, type, add contacts) — Co-Work is JPEG context only; WA actions use Cloud API / Omni  ",
  );
});

patch("docs/team/PANELIN-CHAT-AGENT-SEC.md", (s) => {
  if (s.includes("PANELIN-SESSION-ANALYSIS-2026-07-20")) return s;
  return s.replace(
    "## Related docs",
    "## Related docs\n\n- Session analysis (Co-Work WA leads, 2026-07-20): [`reports/PANELIN-SESSION-ANALYSIS-2026-07-20.md`](./reports/PANELIN-SESSION-ANALYSIS-2026-07-20.md)",
  );
});

console.log("apply-panelin-cowork-w1-w3.mjs done");
