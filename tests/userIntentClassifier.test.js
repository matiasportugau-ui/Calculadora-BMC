// ═══════════════════════════════════════════════════════════════════════════
// Contract tests for server/lib/userIntentClassifier.js
// Run: node tests/userIntentClassifier.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { classifyIntents, INTENT_HINTS, TOOL_INTENT_PATTERNS } from "../server/lib/userIntentClassifier.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

// ── 1. Empty / unrelated input ───────────────────────────────────────────────

group("Empty input → empty set", () => {
  assert(classifyIntents("").size === 0, "empty string");
  assert(classifyIntents(null).size === 0, "null");
  assert(classifyIntents(undefined).size === 0, "undefined");
});

group("Unrelated message → empty set", () => {
  assert(classifyIntents("hola, ¿cómo estás?").size === 0, "greeting");
  assert(classifyIntents("cotizame 100m2 de techo").size === 0, "quote request without write intent");
  assert(classifyIntents("¿cuánto cuesta el ISODEC EPS 100mm?").size === 0, "price question");
});

// ── 2. Each tool's positive triggers ─────────────────────────────────────────

group("guardar_en_crm triggers", () => {
  assert(classifyIntents("guardalo en CRM").has("guardar_en_crm"), "guardalo en CRM");
  assert(classifyIntents("dale, pegalo al CRM").has("guardar_en_crm"), "pegalo al CRM");
  assert(classifyIntents("metelo al CRM").has("guardar_en_crm"), "metelo al CRM");
  assert(classifyIntents("agregalo a la planilla").has("guardar_en_crm"), "agregalo a la planilla");
  assert(classifyIntents("anotalo en el CRM").has("guardar_en_crm"), "anotalo en el CRM");
});

group("enviar_whatsapp_link triggers", () => {
  assert(classifyIntents("mandale por WhatsApp").has("enviar_whatsapp_link"), "mandale por WhatsApp");
  assert(classifyIntents("envialo por whatsapp").has("enviar_whatsapp_link"), "envialo por whatsapp");
  assert(classifyIntents("mandale el link").has("enviar_whatsapp_link"), "mandale el link");
  assert(classifyIntents("envialo al cliente").has("enviar_whatsapp_link"), "envialo al cliente");
  assert(classifyIntents("mandalo al WA").has("enviar_whatsapp_link"), "mandalo al WA");
});

group("cancelar_cotizacion triggers", () => {
  assert(classifyIntents("cancelá la cotización").has("cancelar_cotizacion"), "cancelá la cotización");
  assert(classifyIntents("borrá la cotización").has("cancelar_cotizacion"), "borrá la cotización");
  assert(classifyIntents("el cliente declinó").has("cancelar_cotizacion"), "el cliente declinó");
  assert(classifyIntents("dejar sin efecto").has("cancelar_cotizacion"), "dejar sin efecto");
});

group("programar_seguimiento triggers", () => {
  assert(classifyIntents("recordame en 3 días").has("programar_seguimiento"), "recordame en 3 días");
  assert(classifyIntents("agendá seguimiento").has("programar_seguimiento"), "agendá seguimiento");
  assert(classifyIntents("avisame cuando expire").has("programar_seguimiento"), "avisame cuando expire");
  assert(classifyIntents("ponele recordatorio").has("programar_seguimiento"), "ponele recordatorio");
});

group("wolfboard tool triggers", () => {
  assert(classifyIntents("sincronizá Wolfboard").has("wolfboard_sync"), "sync Wolfboard");
  assert(classifyIntents("propagá las respuestas").has("wolfboard_sync"), "propagá respuestas");
  assert(classifyIntents("actualizá la fila 5").has("wolfboard_actualizar_fila"), "actualizá fila");
  assert(classifyIntents("editá la fila 7").has("wolfboard_actualizar_fila"), "editá fila");
  assert(classifyIntents("marcá como enviada").has("wolfboard_marcar_enviado"), "marcá enviada");
  assert(classifyIntents("ya la envié").has("wolfboard_marcar_enviado"), "ya la envié");
  assert(classifyIntents("generá las respuestas con IA").has("wolfboard_quote_batch"), "generá respuestas IA");
  assert(classifyIntents("cotizá todas las pendientes").has("wolfboard_quote_batch"), "cotizá pendientes");
});

// ── 3. Accent / case insensitivity ───────────────────────────────────────────

group("Accent insensitivity", () => {
  assert(classifyIntents("cancelá la cotizacion").has("cancelar_cotizacion"), "cotizacion (no accent)");
  assert(classifyIntents("CANCELÁ LA COTIZACIÓN").has("cancelar_cotizacion"), "all caps");
  assert(classifyIntents("Cancela la Cotización").has("cancelar_cotizacion"), "title case");
});

// ── 4. Negation handling ─────────────────────────────────────────────────────

group("Negation strips intent", () => {
  assert(!classifyIntents("no lo guardes en el CRM").has("guardar_en_crm"), "no lo guardes");
  assert(!classifyIntents("no quiero guardarlo en CRM").has("guardar_en_crm"), "no quiero guardarlo");
  assert(!classifyIntents("sin enviar al cliente").has("enviar_whatsapp_link"), "sin enviar");
  assert(!classifyIntents("no, no mandes nada por WhatsApp").has("enviar_whatsapp_link"), "no mandes nada");
});

group("Negation stops at conjunction — mixed instruction preserves later intent", () => {
  // Copilot finding: prior stripper consumed everything after "no" up to 6
  // words, swallowing the WhatsApp clause. Now stops at "y" / "o" / punct.
  const set = classifyIntents("no lo guardes en CRM y mandale por WhatsApp");
  assert(!set.has("guardar_en_crm"), "guardar_en_crm correctly stripped");
  assert(set.has("enviar_whatsapp_link"), "WhatsApp intent after `y` survives");

  const set2 = classifyIntents("no canceles, mandale por WA");
  assert(!set2.has("cancelar_cotizacion"), "cancel correctly stripped");
  assert(set2.has("enviar_whatsapp_link"), "WA intent after comma survives");
});

// ── 5. Multi-intent ──────────────────────────────────────────────────────────

group("Multi-intent — multiple triggers in one message", () => {
  const set = classifyIntents("dale, guardalo en CRM y mandale por WhatsApp");
  assert(set.has("guardar_en_crm"), "guardar_en_crm matched");
  assert(set.has("enviar_whatsapp_link"), "enviar_whatsapp_link matched");
  assert(set.size === 2, "exactly 2 intents");
});

// ── 6. Surface checks ────────────────────────────────────────────────────────

group("INTENT_HINTS covers every guarded tool", () => {
  for (const tool of Object.keys(TOOL_INTENT_PATTERNS)) {
    assert(Array.isArray(INTENT_HINTS[tool]) && INTENT_HINTS[tool].length > 0, `${tool} has hints`);
  }
});

group("TOOL_INTENT_PATTERNS sanity", () => {
  assert(Object.keys(TOOL_INTENT_PATTERNS).length === 10, "10 guarded tools covered");
  for (const [tool, patterns] of Object.entries(TOOL_INTENT_PATTERNS)) {
    assert(Array.isArray(patterns) && patterns.length > 0, `${tool}: at least 1 pattern`);
    assert(patterns.every((p) => p instanceof RegExp), `${tool}: all patterns are RegExp`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`userIntentClassifier tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) {
  process.exit(1);
}
