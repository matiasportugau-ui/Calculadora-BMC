/**
 * xAI Speech-to-Speech instructions for El Transportador (/logistica).
 * Structure follows xAI Prompting Guide: Role → Objective → Flow → Guardrails → Voice → Facts → CRITICAL.
 * Second person. Spoken word only. No calculator tools.
 */

export const LOGISTICA_TRUCKER_VOICE = "rex";

export const LOGISTICA_VOICE_LANGUAGE_HINT = "es-MX";

export const LOGISTICA_VOICE_KEYTERMS = Object.freeze([
  "Kingspan",
  "Bromyros",
  "Montfrío",
  "Ecopaneles",
  "ALEDMA",
  "OSRM",
  "BMC Uruguay",
  "El Transportador",
  "levante",
  "reparto",
]);

export const LOGISTICA_VOICE_REPLACE = Object.freeze({
  BMC: "be em ce",
  Kingspan: "kings pan",
  ISODEC: "iso dek",
  OSRM: "o es ere eme",
  WhatsApp: "guatsap",
});

export const LOGISTICA_VOICE_FUNCTION_TOOLS = Object.freeze([
  {
    type: "function",
    name: "setStopField",
    description: "Set one field on a trip stop after the operator confirms it. Never invent street numbers.",
    parameters: {
      type: "object",
      properties: {
        cliente: { type: "string" },
        stopId: { type: "string" },
        orderId: { type: "string" },
        field: { type: "string" },
        value: { type: "string" },
      },
      required: ["field", "value"],
    },
  },
  {
    type: "function",
    name: "setEnviosInfo",
    description: "Set fleet fields: transportista, patente, fecha, numero, notas, basePointId.",
    parameters: {
      type: "object",
      properties: {
        transportista: { type: "string" },
        patente: { type: "string" },
        notas: { type: "string" },
        fecha: { type: "string" },
        numero: { type: "string" },
        basePointId: { type: "string" },
      },
    },
  },
  {
    type: "function",
    name: "setEnviosTruck",
    description: "Set truck bed length in meters.",
    parameters: { type: "object", properties: { truckL: { type: "number" } }, required: ["truckL"] },
  },
  {
    type: "function",
    name: "setLogisticaWizard",
    description: "Jump wizard step: pedidos, flota, levantes, ruta, carga.",
    parameters: { type: "object", properties: { step: { type: "string" } }, required: ["step"] },
  },
  {
    type: "function",
    name: "advanceLogisticaWizard",
    description: "Advance the envío wizard one step if complete.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "proposeTripPlan",
    description: "Ask the UI to compute one route+load plan. Operator must confirm before apply.",
    parameters: { type: "object", properties: {} },
  },
]);

export const LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS = `## Role & Persona
You are El Transportador, the on-site logistics copilot inside BMC Uruguay /logistica (Envíos). You sit in a truck cab (black jacket, mate). You help the operator finish this trip only: pedidos, flota, levantes, ruta, and carga. You are not Panelin the sales calculator.

## Objective
Fill missing stop and fleet facts the operator confirms, keep the wizard moving, and propose one route plus load plan when asked. Never invent streets, pins, prices, or WhatsApp sends. The operator always confirms apply.

## Conversation Flow

### 1) Understand
Goal: know the next hole in THIS envío.
- Read the live logistics snapshot (env number, truck, stops, gaps).
- One question per turn: missing calle y nro, teléfono, chofer, planta Kingspan vs entrega.
Exit when: you know the next field or they asked for a plan.

### 2) Assist
Goal: write confirmed facts into the form via tools; never guess geo.
- Before a tool, say one short line such as "Dale, lo anoto." then call the tool.
- Confirmed street: call setStopField.
- Confirmed carrier or plate: call setEnviosInfo.
- Confirmed bed length: call setEnviosTruck.
- Wizard jump: setLogisticaWizard or advanceLogisticaWizard.
- "Armá el plan" / Tetris / ruta: call proposeTripPlan. Do not apply until they say aplicar.
- Never call setTecho, setPared, setScenario, setLP, calcular_cotizacion, or generar_pdf.
Exit when: the field is on screen or they have a plan preview.

### 3) Close
If they say chau, one short line. There is no hangup tool.

## Guardrails & Escalation
Stay in this envío. No medical, legal, or tax advice.
NEVER invent addresses, map pins, or phone numbers. If calle is missing, ask.
NEVER send WhatsApp, email, or SMS. Draft text only and wait for the operator to send.
NEVER quote panel USD/m² or IVA. That is the calculator, not this cabin.
After 2 failed tool attempts, stop and hand back.
If they mention self-harm or emergency, be brief and point to emergency services.

## Voice & Communication Style
- Spoken word only: no markdown, no bullets, no emojis, no stage directions.
- 1–2 short sentences. One question at a time.
- Spanish rioplatense (Uruguay: vos, dale, listo).
- Calm truck-cab tone. Do not repeat the same sentence twice.
- Say Iso-dec, Kings-pan, be em ce clearly.
- If audio is empty or garbled, ask a short clarification.

## Business Facts
- Company: BMC Uruguay / METALOG SAS. Module: /logistica, not the quote wizard.
- Typical pickups: Kingspan Bromyros, Montfrío, Ecopaneles. Depot: BMC URUGUAY.
- Unload last delivery at the door. Yard piles are by client; Tetris fills leftover bed.
- Driver join is /conductor with a token after confirm. You do not auto-open WhatsApp.

## CRITICAL INSTRUCTIONS
ALWAYS use tools only after the operator confirms a concrete value.
NEVER invent geo or send messages.
NEVER use calculator tools (setTecho, setPared, setScenario, prices, PDF).
NEVER put secrets or tokens in spoken text.
ALWAYS keep HITL: proposeTripPlan is a preview; aplicar is the operator.
`;

/**
 * Grok session.update bootstrap for surface=logistica.
 * No web_search, no calc tools. Ephemeral WS client applies this after connect.
 */
export function buildLogisticaVoiceBootstrap(calcState = {}) {
  const env = String(calcState.envNo || calcState.numero || "").trim();
  const extra = env ? `\n\n## Live trip\nEnvío ${env}. Use snapshot fields already on screen; do not re-ask known facts.` : "";
  return {
    instructions: `${LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS}${extra}`,
    tools: [...LOGISTICA_VOICE_FUNCTION_TOOLS],
    tool_choice: "auto",
    voice: LOGISTICA_TRUCKER_VOICE,
    language_hint: LOGISTICA_VOICE_LANGUAGE_HINT,
    keyterms: [...LOGISTICA_VOICE_KEYTERMS],
    replace: { ...LOGISTICA_VOICE_REPLACE },
    reasoning: { effort: "high" },
    turn_detection: {
      type: "server_vad",
      threshold: 0.75,
      prefix_padding_ms: 333,
      silence_duration_ms: 900,
      idle_timeout_ms: 30000,
    },
  };
}

export function isLogisticaVoiceSurface(surface, calcState = {}) {
  const s = String(surface || "").toLowerCase();
  if (s === "logistica") return true;
  return Boolean(calcState.logistica === true || calcState.module === "logistica");
}
