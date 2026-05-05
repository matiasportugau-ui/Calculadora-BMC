// ═══════════════════════════════════════════════════════════════════════════
// WA Cockpit — Enricher unit tests (offline)
// Pruebas puras de classifyIntent y parseSuggestionJson.
// ═══════════════════════════════════════════════════════════════════════════

import { classifyIntent, parseSuggestionJson, buildMessagesFromHistory } from "../server/lib/waEnricher.js";

let passed = 0;
let failed = 0;

function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

console.log("\n═══ WA Cockpit · F2 enricher ═══");

// ── classifyIntent ─────────────────────────────────────────────────────
{
  assert("intent: cotizacion (precio)", classifyIntent("cuánto sale ISODEC EPS 100mm 200m²?") === "cotizacion", classifyIntent("cuánto sale"), "cotizacion");
  assert("intent: cotizacion (m²)", classifyIntent("necesito 200 m2") === "cotizacion", classifyIntent("200 m2"), "cotizacion");
  assert("intent: consulta_tecnica", classifyIntent("qué espesor recomiendan para fachada?") === "consulta_tecnica", classifyIntent("espesor"), "consulta_tecnica");
  assert("intent: cierre", classifyIntent("listo, mando la orden de compra") === "cierre", "cierre", "cierre");
  assert("intent: chatter (ok)", classifyIntent("ok") === "chatter", classifyIntent("ok"), "chatter");
  assert("intent: chatter (gracias)", classifyIntent("gracias") === "chatter", classifyIntent("gracias"), "chatter");
  assert("intent: chatter (vacío)", classifyIntent("") === "chatter", "", "chatter");
  assert("intent: follow_up", classifyIntent("seguimos con el presupuesto del lunes?") === "cotizacion" || classifyIntent("seguimos con el presupuesto del lunes?") === "follow_up", true, "matches one of");
  assert("intent: objecion", classifyIntent("me parece caro, ¿podés mejorar?") === "objecion", classifyIntent("caro"), "objecion");
}

// ── parseSuggestionJson ────────────────────────────────────────────────
{
  const valid = JSON.stringify({
    intent: "cotizacion",
    confidence: 0.8,
    options: [
      { tone: "corta", text: "Para 200m² ISODEC EPS 100mm aprox USD 9.194 + IVA. Mando link?" },
      { tone: "tecnica", text: "200m² × USD 45,97/m² = USD 9.194 sin IVA. Espesor 100mm cubre autoportancia 4m. Color blanco stock; gris/rojo +20 días." },
      { tone: "cierre", text: "Te genero el link de cotización ahora? Necesito confirmar bordes (canalón, cumbrera) y color." },
    ],
  });
  const r = parseSuggestionJson(valid);
  assert("parses valid JSON", r != null, !!r, true);
  assert("intent extracted", r?.intent === "cotizacion", r?.intent, "cotizacion");
  assert("3 options extracted", r?.options?.length === 3, r?.options?.length, 3);
  assert("first option tone is corta", r?.options?.[0]?.tone === "corta", r?.options?.[0]?.tone, "corta");
}
{
  const wrapped = "```json\n" + JSON.stringify({ intent: "consulta_tecnica", confidence: 0.5, options: [{ tone: "corta", text: "ok" }] }) + "\n```";
  const r = parseSuggestionJson(wrapped);
  assert("strips code fences", r != null && r.intent === "consulta_tecnica", r?.intent, "consulta_tecnica");
}
{
  const noisy = "Aquí va el JSON:\n" + JSON.stringify({ intent: "cierre", options: [{ tone: "cierre", text: "Te llamo." }] }) + "\nEspero te sirva.";
  const r = parseSuggestionJson(noisy);
  assert("extracts JSON from noisy text", r?.intent === "cierre", r?.intent, "cierre");
}
{
  const r = parseSuggestionJson("not json at all");
  assert("rejects non-JSON", r == null, r, null);
}
{
  const bad = JSON.stringify({ intent: "no_existe", options: [{ tone: "raro", text: "x" }] });
  const r = parseSuggestionJson(bad);
  assert("normalizes invalid intent to null", r?.intent === null, r?.intent, null);
  assert("filters invalid tone options", r?.options?.length === 0, r?.options?.length, 0);
}
{
  const bigText = JSON.stringify({
    intent: "cotizacion",
    options: [{ tone: "corta", text: "x".repeat(1000) }],
  });
  const r = parseSuggestionJson(bigText);
  assert("truncates option text to 600 chars", r?.options?.[0]?.text?.length === 600, r?.options?.[0]?.text?.length, 600);
}
{
  const fourOpts = JSON.stringify({
    intent: "consulta_tecnica",
    options: [
      { tone: "corta", text: "a" },
      { tone: "tecnica", text: "b" },
      { tone: "cierre", text: "c" },
      { tone: "corta", text: "d" },
    ],
  });
  const r = parseSuggestionJson(fourOpts);
  assert("caps options at 3", r?.options?.length === 3, r?.options?.length, 3);
}

// ── buildMessagesFromHistory ────────────────────────────────────────────
{
  const hist = [
    { direction: "in", text: "hola" },
    { direction: "out", text: "buenas, ¿en qué te ayudo?" },
    { direction: "in", text: "ISODEC 100mm 200m²" },
    { direction: "in", text: null },
    { direction: "in", text: "" },
  ];
  const msgs = buildMessagesFromHistory(hist);
  assert("filters empty/null text", msgs.length === 3, msgs.length, 3);
  assert("first is user (direction in)", msgs[0]?.role === "user", msgs[0]?.role, "user");
  assert("second is assistant (direction out)", msgs[1]?.role === "assistant", msgs[1]?.role, "assistant");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
