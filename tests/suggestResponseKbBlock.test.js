// F3.1 smoke — verify the KB block construction logic that suggest-response
// uses, without spinning up the full Express route or hitting an LLM.
//
// We exercise the same helpers in the same order, with a stubbed KB so the
// test is hermetic.
//
// Run: node tests/suggestResponseKbBlock.test.js

import { mapOrigenToSurface } from "../server/lib/kbSurface.js";
import { resolveTrainingAnswer } from "../server/lib/trainingKB.js";

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
 * Mirrors the inline logic in bmcDashboard.js /crm/suggest-response.
 * Takes a stubbed `findRelevantExamples` so we control the matchScore
 * threshold path without depending on the on-disk KB.
 */
function buildKbBlock({ origen, consulta: _consulta, retrieved }) {
  const surface = mapOrigenToSurface(origen);
  const matches = retrieved.filter((m) => (m.matchScore ?? 0) >= 2);
  if (matches.length === 0) return "";
  const items = matches
    .map((m, i) => {
      const text = resolveTrainingAnswer(m, surface);
      return text ? `[${i + 1}] ${text}` : null;
    })
    .filter(Boolean);
  if (items.length === 0) return "";
  // The `consulta` arg above is intentionally unused: in the real route it
  // is consumed inside findRelevantExamples; we stub the retrieval, so the
  // arg is here only to keep the call shape identical to the route.
  return `Políticas / FAQs relevantes (usar como guía):\n${items.join("\n")}`;
}

const ENTRY_ML_OVERRIDE = {
  id: "kb-1",
  question: "¿Stock isodec PIR 80?",
  goodAnswer: "El Isodec PIR 80 mm está en stock para entregas en 48hs hábiles desde nuestro depósito de Montevideo. Saludos BMC URUGUAY!",
  goodAnswerML: "Isodec PIR 80mm en stock — entrega 48hs desde MVD. Saludos BMC URUGUAY!",
  matchScore: 5,
};

const ENTRY_GENERIC = {
  id: "kb-2",
  question: "¿Qué color recomiendan?",
  goodAnswer: "Recomendamos Blanco para techos por reflectividad.",
  matchScore: 3,
};

const ENTRY_WEAK = {
  id: "kb-3",
  question: "Algo poco relacionado",
  goodAnswer: "Texto irrelevante.",
  matchScore: 1, // below threshold
};

group("ML origen prefers ML override", () => {
  const block = buildKbBlock({
    origen: "ML",
    consulta: "Tienen stock?",
    retrieved: [ENTRY_ML_OVERRIDE],
  });
  assert(block.includes("Políticas / FAQs relevantes"), "header present");
  assert(block.includes("Isodec PIR 80mm en stock — entrega 48hs"), "uses ML override (≤ 350c)");
  assert(!block.includes("48hs hábiles desde nuestro depósito"), "does NOT use canonical long form");
});

group("Mercado Libre full string maps to ML", () => {
  const block = buildKbBlock({
    origen: "Mercado Libre",
    consulta: "x",
    retrieved: [ENTRY_ML_OVERRIDE],
  });
  assert(block.includes("Isodec PIR 80mm en stock"), "Mercado Libre origen → ML override");
});

group("WA origen falls back to canonical when no WA override", () => {
  const block = buildKbBlock({
    origen: "WA",
    consulta: "x",
    retrieved: [ENTRY_ML_OVERRIDE],
  });
  assert(block.includes("48hs hábiles desde nuestro depósito"), "WA → canonical fallback");
});

group("CRM/unknown origen uses panelin_chat surface (canonical)", () => {
  const block = buildKbBlock({
    origen: "CRM",
    consulta: "x",
    retrieved: [ENTRY_GENERIC],
  });
  assert(block.includes("Recomendamos Blanco para techos"), "CRM → canonical");
});

group("Threshold filter: matchScore < 2 dropped", () => {
  const block = buildKbBlock({
    origen: "ML",
    consulta: "x",
    retrieved: [ENTRY_WEAK],
  });
  assert(block === "", "weak match → no block");
});

group("Empty retrieved → empty block", () => {
  const block = buildKbBlock({ origen: "ML", consulta: "x", retrieved: [] });
  assert(block === "", "no entries → no block");
});

group("Multiple matches: numbered, in order", () => {
  const block = buildKbBlock({
    origen: "ML",
    consulta: "x",
    retrieved: [ENTRY_ML_OVERRIDE, ENTRY_GENERIC, ENTRY_WEAK],
  });
  const lines = block.split("\n");
  assert(lines.length === 3, "header + 2 items (weak filtered)");
  assert(lines[1].startsWith("[1] Isodec PIR 80mm"), "[1] = ML override");
  assert(lines[2].startsWith("[2] Recomendamos Blanco"), "[2] = canonical for entry 2");
});

group("Block goes BEFORE consulta in the prompt assembly", () => {
  // Mirrors how bmcDashboard builds the userMsg.
  const block = buildKbBlock({
    origen: "ML",
    consulta: "Tienen stock?",
    retrieved: [ENTRY_ML_OVERRIDE],
  });
  const userMsg = [
    "Canal: ML",
    "Cliente: Juan",
    block || null,
    "Consulta: Tienen stock?",
  ].filter(Boolean).join("\n");
  const idxBlock = userMsg.indexOf("Políticas / FAQs");
  const idxConsulta = userMsg.indexOf("Consulta:");
  assert(idxBlock > 0 && idxBlock < idxConsulta, "KB block precedes Consulta");
});

console.log(`\nsuggestResponseKbBlock: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
