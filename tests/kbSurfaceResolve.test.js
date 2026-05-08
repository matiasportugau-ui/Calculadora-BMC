// Tests para resolveTrainingAnswer + kbSurface helpers.
// Run: node tests/kbSurfaceResolve.test.js
//
// Brief: docs/team/panelsim/knowledge/KB-MULTICANAL-DESIGN-V2.md §6.1-6.4
// E2E DoD: D1 + D2 (Fase 1).

import {
  KB_SURFACES,
  SURFACE_LIMITS,
  normalizeSurface,
} from "../server/lib/kbSurface.js";
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

// ─── kbSurface helpers ────────────────────────────────────────────────────────

group("KB_SURFACES enum", () => {
  assert(Array.isArray(KB_SURFACES), "KB_SURFACES is array");
  assert(KB_SURFACES.includes("panelin_chat"), "includes panelin_chat");
  assert(KB_SURFACES.includes("mercado_libre"), "includes mercado_libre");
  assert(KB_SURFACES.includes("whatsapp"), "includes whatsapp");
  assert(KB_SURFACES.includes("email"), "includes email");
  assert(KB_SURFACES.includes("wolfboard"), "includes wolfboard");
});

group("SURFACE_LIMITS per-surface caps", () => {
  assert(SURFACE_LIMITS.mercado_libre === 350, "mercado_libre = 350");
  assert(SURFACE_LIMITS.whatsapp === 700, "whatsapp = 700");
  assert(SURFACE_LIMITS.email === 2000, "email = 2000");
  assert(SURFACE_LIMITS.panelin_chat === 4000, "panelin_chat = 4000");
  assert(SURFACE_LIMITS.wolfboard === 4000, "wolfboard = 4000");
});

group("normalizeSurface", () => {
  assert(normalizeSurface("panelin_chat") === "panelin_chat", "valid passes through");
  assert(normalizeSurface("mercado_libre") === "mercado_libre", "ml passes");
  assert(normalizeSurface("unknown") === "panelin_chat", "unknown → default");
  assert(normalizeSurface(null) === "panelin_chat", "null → default");
  assert(normalizeSurface(undefined) === "panelin_chat", "undefined → default");
  assert(normalizeSurface("") === "panelin_chat", "empty → default");
  assert(normalizeSurface(123) === "panelin_chat", "non-string → default");
});

// ─── resolveTrainingAnswer — fallback chain ─────────────────────────────────

group("Case 1: entry sólo con goodAnswer (legacy puro)", () => {
  const entry = { goodAnswer: "Respuesta canónica corta." };
  assert(resolveTrainingAnswer(entry, "panelin_chat") === "Respuesta canónica corta.", "panelin_chat → goodAnswer");
  assert(resolveTrainingAnswer(entry, "mercado_libre") === "Respuesta canónica corta.", "mercado_libre → goodAnswer fallback");
  assert(resolveTrainingAnswer(entry, "whatsapp") === "Respuesta canónica corta.", "whatsapp → goodAnswer fallback");
  assert(resolveTrainingAnswer(entry, "email") === "Respuesta canónica corta.", "email → goodAnswer fallback");
});

group("Case 2: entry con goodAnswerML y goodAnswer (legacy mixto)", () => {
  const entry = {
    goodAnswer: "Versión larga canónica de la respuesta.",
    goodAnswerML: "Versión corta ML.",
    goodAnswerWA: "Versión WA.",
  };
  assert(resolveTrainingAnswer(entry, "mercado_libre") === "Versión corta ML.", "ML usa goodAnswerML");
  assert(resolveTrainingAnswer(entry, "whatsapp") === "Versión WA.", "WA usa goodAnswerWA");
  assert(resolveTrainingAnswer(entry, "panelin_chat") === "Versión larga canónica de la respuesta.", "chat usa goodAnswer");
  assert(resolveTrainingAnswer(entry, "email") === "Versión larga canónica de la respuesta.", "email cae a goodAnswer");
});

group("Case 3: entry con responses map (nuevo shape)", () => {
  const entry = {
    goodAnswer: "Legacy chiquito",
    responses: {
      default: "Default del map.",
      mercado_libre: "Override ML del map.",
      whatsapp: "Override WA del map.",
      email: "Override email del map.",
    },
  };
  assert(resolveTrainingAnswer(entry, "mercado_libre") === "Override ML del map.", "ML lee del map");
  assert(resolveTrainingAnswer(entry, "whatsapp") === "Override WA del map.", "WA lee del map");
  assert(resolveTrainingAnswer(entry, "email") === "Override email del map.", "email lee del map");
  assert(resolveTrainingAnswer(entry, "panelin_chat") === "Default del map.", "chat lee responses.default");
});

group("Case 3b: responses.default precede a goodAnswer legacy", () => {
  const entry = {
    goodAnswer: "Texto legacy.",
    responses: { default: "Texto del nuevo shape." },
  };
  assert(resolveTrainingAnswer(entry, "panelin_chat") === "Texto del nuevo shape.", "responses.default gana");
  assert(resolveTrainingAnswer(entry, "wolfboard") === "Texto del nuevo shape.", "wolfboard también");
});

group("Case 3c: responses parcial cae al fallback correcto", () => {
  const entry = {
    goodAnswer: "Legacy fallback.",
    goodAnswerML: "Legacy ML fallback.",
    responses: { whatsapp: "Sólo WA en map." },
  };
  assert(resolveTrainingAnswer(entry, "whatsapp") === "Sólo WA en map.", "WA usa map");
  assert(resolveTrainingAnswer(entry, "mercado_libre") === "Legacy ML fallback.", "ML cae a goodAnswerML legacy");
  assert(resolveTrainingAnswer(entry, "panelin_chat") === "Legacy fallback.", "chat cae a goodAnswer legacy");
});

group("Case 4: surface desconocido → default panelin_chat", () => {
  const entry = {
    goodAnswer: "Canónico.",
    goodAnswerML: "ML.",
    responses: { default: "Default map.", mercado_libre: "ML map." },
  };
  assert(resolveTrainingAnswer(entry, "instagram") === "Default map.", "surface inválido cae a panelin_chat");
  assert(resolveTrainingAnswer(entry, null) === "Default map.", "null cae a panelin_chat");
  assert(resolveTrainingAnswer(entry, undefined) === "Default map.", "undefined cae a panelin_chat");
  assert(resolveTrainingAnswer(entry) === "Default map.", "sin arg cae a panelin_chat");
});

group("Case 5: truncado al límite del canal", () => {
  const longText = "x".repeat(800);
  const entry = { goodAnswer: longText };
  const ml = resolveTrainingAnswer(entry, "mercado_libre");
  assert(ml.length === 350, "ML truncado a 350");
  assert(ml.endsWith("…"), "ML termina en ellipsis");
  const wa = resolveTrainingAnswer(entry, "whatsapp");
  assert(wa.length === 700, "WA truncado a 700");
  assert(wa.endsWith("…"), "WA termina en ellipsis");
  const chat = resolveTrainingAnswer(entry, "panelin_chat");
  assert(chat === longText, "chat NO truncado (800 < 4000)");
});

group("Case 6: texto exactamente en el límite no se trunca", () => {
  const exact = "y".repeat(350);
  const entry = { goodAnswerML: exact };
  const out = resolveTrainingAnswer(entry, "mercado_libre");
  assert(out === exact, "350 chars exactos quedan intactos");
  assert(!out.endsWith("…"), "no añade ellipsis");
});

group("Case 7: entry sin nada → string vacío", () => {
  assert(resolveTrainingAnswer({}, "panelin_chat") === "", "entry vacío");
  assert(resolveTrainingAnswer({}, "mercado_libre") === "", "ML sin nada");
  assert(resolveTrainingAnswer(null, "panelin_chat") === "", "null entry");
  assert(resolveTrainingAnswer(undefined, "mercado_libre") === "", "undefined entry");
});

group("Case 8: campos vacíos no son válidos para fallback", () => {
  const entry = {
    goodAnswer: "Real.",
    goodAnswerML: "",
    responses: { mercado_libre: "" },
  };
  assert(resolveTrainingAnswer(entry, "mercado_libre") === "Real.", "ML vacío en map y legacy → cae a goodAnswer");
});

group("Case 9: respeta defaultSurface arg", () => {
  const entry = { goodAnswer: "Texto." };
  assert(resolveTrainingAnswer(entry, "panelin_chat") === "Texto.", "panelin_chat default explícito");
});

console.log(`\nkbSurfaceResolve: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
