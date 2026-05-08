// F2 wiring test — verifies that the surface body field flows through to
// the resolver before buildSystemPrompt receives the training examples.
//
// We don't spin up the SSE route or call any LLM. We exercise the same
// resolver+normalize path the route uses, with realistic KB-shaped entries.
//
// Run: node tests/agentChatSurfaceWiring.test.js

import { resolveTrainingAnswer } from "../server/lib/trainingKB.js";
import { normalizeSurface } from "../server/lib/kbSurface.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

/**
 * Mirrors the exact mapping done in server/routes/agentChat.js after
 * findRelevantExamples returns. If this stays in sync, the route is
 * also in sync (since the route imports the same helpers).
 */
function mapForSurface(entries, rawSurface) {
  const surface = normalizeSurface(rawSurface);
  return entries.map((entry) => ({
    ...entry,
    goodAnswer: resolveTrainingAnswer(entry, surface) || entry.goodAnswer || "",
  }));
}

// Realistic dataset shape — mimics findRelevantExamples output (entry + matchScore).
const KB_FIXTURE = [
  {
    id: "e1",
    category: "sales",
    question: "¿Cuánto cuesta el isodec PIR 80?",
    goodAnswer: "El Isodec PIR 80 mm cuesta USD 42/m² (lista web, IVA incluido). Precio firme. Saludos BMC URUGUAY!",
    goodAnswerML: "Isodec PIR 80mm: USD 42/m² IVA incluido (lista web). Saludos BMC URUGUAY!",
    matchScore: 5,
  },
  {
    id: "e2",
    category: "product",
    question: "¿Qué color recomiendan?",
    goodAnswer: "Recomendamos Blanco para techos por reflectividad y disponibilidad inmediata.",
    responses: {
      default: "Recomendamos Blanco para techos por reflectividad y disponibilidad inmediata.",
      mercado_libre: "Recomendamos Blanco — más reflectivo y disponible. Saludos BMC!",
      whatsapp: "Hola! Para techos siempre recomendamos Blanco — refleja más y siempre tenemos stock 👍",
    },
    matchScore: 3,
  },
];

group("F2 wiring — surface=panelin_chat (default)", () => {
  const out = mapForSurface(KB_FIXTURE, "panelin_chat");
  assert(out[0].goodAnswer.startsWith("El Isodec PIR 80 mm cuesta USD 42"), "e1 keeps canonical goodAnswer");
  assert(out[1].goodAnswer.startsWith("Recomendamos Blanco para techos"), "e2 uses responses.default");
  assert(out[0].matchScore === 5, "matchScore preserved");
});

group("F2 wiring — surface=mercado_libre", () => {
  const out = mapForSurface(KB_FIXTURE, "mercado_libre");
  assert(out[0].goodAnswer === "Isodec PIR 80mm: USD 42/m² IVA incluido (lista web). Saludos BMC URUGUAY!", "e1 uses goodAnswerML legacy");
  assert(out[1].goodAnswer.startsWith("Recomendamos Blanco — más reflectivo"), "e2 uses responses.mercado_libre");
  assert(out[1].goodAnswer.length <= 350, "ML override under 350 chars");
});

group("F2 wiring — surface=whatsapp", () => {
  const out = mapForSurface(KB_FIXTURE, "whatsapp");
  assert(out[1].goodAnswer.includes("Hola!"), "e2 uses responses.whatsapp variant");
  assert(out[0].goodAnswer.startsWith("El Isodec PIR 80 mm"), "e1 falls back to goodAnswer (no WA override)");
});

group("F2 wiring — surface=email", () => {
  const out = mapForSurface(KB_FIXTURE, "email");
  // Email has no override on either entry → falls to responses.default for e2 and goodAnswer for e1.
  assert(out[0].goodAnswer.startsWith("El Isodec PIR 80 mm"), "e1 falls back to canonical");
  assert(out[1].goodAnswer.startsWith("Recomendamos Blanco para techos"), "e2 falls back to responses.default");
});

group("F2 wiring — invalid surface defaults to panelin_chat", () => {
  const fromUnknown = mapForSurface(KB_FIXTURE, "tiktok");
  const fromChat = mapForSurface(KB_FIXTURE, "panelin_chat");
  assert(fromUnknown[0].goodAnswer === fromChat[0].goodAnswer, "unknown surface ≡ panelin_chat (e1)");
  assert(fromUnknown[1].goodAnswer === fromChat[1].goodAnswer, "unknown surface ≡ panelin_chat (e2)");
});

group("F2 wiring — undefined surface defaults to panelin_chat", () => {
  const out = mapForSurface(KB_FIXTURE, undefined);
  assert(out[0].goodAnswer.startsWith("El Isodec PIR 80 mm"), "undefined → canonical");
});

group("F2 wiring — empty entries array stays empty", () => {
  const out = mapForSurface([], "mercado_libre");
  assert(Array.isArray(out) && out.length === 0, "empty → empty");
});

group("F2 wiring — preserves all original fields besides goodAnswer", () => {
  const out = mapForSurface(KB_FIXTURE, "mercado_libre");
  assert(out[0].id === "e1", "id preserved");
  assert(out[0].category === "sales", "category preserved");
  assert(out[0].question.startsWith("¿Cuánto cuesta"), "question preserved");
  assert(out[0].matchScore === 5, "matchScore preserved");
  assert(out[0].goodAnswerML === KB_FIXTURE[0].goodAnswerML, "goodAnswerML still on entry");
});

console.log(`\nagentChatSurfaceWiring: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
